import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'

interface BuildResult {
  status: 'success' | 'failure' | 'in_progress'
  durationMs: number
  artifacts: string[]
  logs: string[]
  errors: string[]
  warnings: string[]
}

interface DeployResult {
  environment: string
  status: 'deployed' | 'failed' | 'rolling_back'
  url?: string
  version: string
  durationMs: number
  steps: Array<{ name: string; status: string; duration: number }>
}

interface InfrastructureStatus {
  services: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'down'
    uptime: number
    version: string
  }>
  resources: {
    cpu: number
    memory: number
    disk: number
  }
  alerts: string[]
}

export class DeploymentAgent extends BaseAgent {
  private deploymentHistory: DeployResult[] = []
  private buildCache = new Map<string, BuildResult>()

  async onStart(): Promise<void> {
    this.logger.info('Deployment agent ready')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(build|compile|bundle|package)\b/.test(normalized)) {
      return this.handleBuild(message)
    }

    if (/\b(deploy|release|publish|ship)\b/.test(normalized)) {
      return this.handleDeploy(message)
    }

    if (/\b(rollback|revert|undo)\b/.test(normalized)) {
      return this.handleRollback(message)
    }

    if (/\b(infra|infrastructure|provision|terraform|cloud)\b/.test(normalized)) {
      return this.handleInfrastructure(message)
    }

    if (/\b(docker|container|image)\b/.test(normalized)) {
      return this.handleDocker(message)
    }

    if (/\b(kubernetes|k8s|pod|service|deployment)\b/.test(normalized)) {
      return this.handleKubernetes(message)
    }

    if (/\b(status|health|check|monitor)\b/.test(normalized)) {
      return this.handleStatus(message)
    }

    if (/\b(env|environment|config)\b/.test(normalized)) {
      return this.handleEnvironment(message)
    }

    return this.handleGeneralDeployment(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Deployment error', { error: error.message, taskId: message.id })

    this.broadcast('deployment.error', {
      taskId: message.id,
      error: error.message,
      traceId: message.metadata.traceId,
    })
  }

  private async handleBuild(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const buildTarget = this.extractBuildTarget(task) ?? 'default'
    const buildTool = this.detectBuildTool(task)
    const cacheKey = `${buildTarget}-${buildTool}`

    const cached = this.buildCache.get(cacheKey)
    if (cached && cached.status === 'success' && !/\b(rebuild|force|clean)\b/i.test(task)) {
      this.logger.info('Returning cached build result', { cacheKey })
      return this.reply(message, { data: { ...cached, cached: true } })
    }

    this.logger.info('Starting build', { target: buildTarget, tool: buildTool })

    const startTime = Date.now()
    try {
      const commands: string[] = []
      if (/clean/i.test(task)) commands.push(`${buildTool} clean`)
      commands.push(`${buildTool} ${buildTarget === 'default' ? 'build' : buildTarget}`)

      const output = await this.callTool('terminal', {
        command: commands.join(' && '),
        timeout: this.config.limits.timeout,
      })

      const result = this.parseBuildOutput(output as string, startTime)
      this.buildCache.set(cacheKey, result)

      await this.storeProcedural(JSON.stringify(result, null, 2), { type: 'build', target: buildTarget })

      if (result.status === 'failure') {
        this.broadcast('deployment.build.failed', { target: buildTarget, errors: result.errors })
      }

      return this.reply(message, { data: result })
    } catch (error) {
      const result: BuildResult = {
        status: 'failure',
        durationMs: Date.now() - startTime,
        artifacts: [],
        logs: [(error as Error).message],
        errors: [(error as Error).message],
        warnings: [],
      }
      return this.reply(message, { data: result })
    }
  }

  private async handleDeploy(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const environment = this.extractEnvironment(task) ?? 'staging'
    const version = this.extractVersion(task) ?? `v${Date.now()}`
    const strategy = this.extractDeployStrategy(task)

    this.logger.info('Starting deployment', { environment, version, strategy })

    if (environment === 'production' && !/\b(force|emergency)\b/i.test(task)) {
      const approval = await this.requestApproval(`Deploy ${version} to production?`)
      if (!approval) {
        return this.reply(message, { data: { error: 'Production deployment requires approval', status: 'blocked' } })
      }
    }

    const steps: DeployResult['steps'] = []
    const startTime = Date.now()

    try {
      const buildResult = await this.handleBuild({
        ...message,
        payload: { ...message.payload, task: `build ${environment} ${version}` },
      })
      steps.push({ name: 'build', status: 'completed', duration: Date.now() - startTime })
      if (buildResult.payload.data?.status === 'failure') {
        throw new AgentError('Build failed, aborting deployment')
      }

      const healthCheck = await this.checkHealth(environment)
      if (!healthCheck) {
        steps.push({ name: 'health_check', status: 'skipped', duration: 0 })
        this.logger.warn('Health check endpoint not configured, skipping')
      } else {
        steps.push({ name: 'health_check', status: 'completed', duration: Date.now() - startTime })
      }

      this.logger.info('Deploying to environment', { environment })

      const deployOutput = await this.callTool('terminal', {
        command: this.getDeployCommand(environment, version, strategy),
        timeout: this.config.limits.timeout,
      })

      steps.push({ name: 'deploy', status: 'completed', duration: Date.now() - startTime })

      const result: DeployResult = {
        environment,
        status: 'deployed',
        url: this.getEnvironmentUrl(environment),
        version,
        durationMs: Date.now() - startTime,
        steps,
      }

      this.deploymentHistory.push(result)

      this.broadcast('deployment.completed', { environment, version })

      await this.storeProcedural(JSON.stringify(result, null, 2), { type: 'deployment', environment, version })

      return this.reply(message, { data: result })
    } catch (error) {
      const failedResult: DeployResult = {
        environment,
        status: 'failed',
        version,
        durationMs: Date.now() - startTime,
        steps: [...steps, { name: 'deploy', status: 'failed', duration: Date.now() - startTime }],
      }
      this.deploymentHistory.push(failedResult)

      this.broadcast('deployment.failed', { environment, version, error: (error as Error).message })

      return this.reply(message, { data: failedResult })
    }
  }

  private async handleRollback(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const environment = this.extractEnvironment(task) ?? 'staging'
    const targetVersion = this.extractVersion(task)

    this.logger.info('Rolling back deployment', { environment, targetVersion })

    try {
      const command = targetVersion
        ? `npm run deploy:rollback -- --env=${environment} --version=${targetVersion}`
        : `npm run deploy:rollback -- --env=${environment}`

      const output = await this.callTool('terminal', {
        command,
        timeout: this.config.limits.timeout,
      })

      const result: DeployResult = {
        environment,
        status: 'rolling_back',
        version: targetVersion ?? 'previous',
        durationMs: 0,
        steps: [{ name: 'rollback', status: 'completed', duration: 0 }],
      }

      this.deploymentHistory.push(result)

      return this.reply(message, {
        data: {
          status: 'rolled_back',
          environment,
          toVersion: targetVersion ?? 'previous',
          output,
        },
      })
    } catch (error) {
      throw new AgentError(`Rollback failed: ${(error as Error).message}`, { environment })
    }
  }

  private async handleInfrastructure(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const infraCommands = [
      'terraform init',
      'terraform plan',
      'terraform apply -auto-approve',
    ]

    this.logger.info('Managing infrastructure')

    try {
      const results: string[] = []
      for (const cmd of infraCommands) {
        const output = await this.callTool('terminal', {
          command: cmd,
          timeout: this.config.limits.timeout,
        })
        results.push(output as string)
      }

      return this.reply(message, { data: { status: 'applied', outputs: results } })
    } catch (error) {
      throw new AgentError(`Infrastructure operation failed: ${(error as Error).message}`)
    }
  }

  private async handleDocker(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const imageName = this.extractImageName(task) ?? 'app'
    const tag = this.extractVersion(task) ?? 'latest'

    this.logger.info('Docker operation', { imageName, tag })

    try {
      if (/\b(build|create)\b/i.test(task)) {
        const output = await this.callTool('terminal', {
          command: `docker build -t ${imageName}:${tag} .`,
          timeout: this.config.limits.timeout,
        })
        return this.reply(message, { data: { image: `${imageName}:${tag}`, built: true, output } })
      }

      if (/\b(push|upload)\b/i.test(task)) {
        const output = await this.callTool('terminal', {
          command: `docker push ${imageName}:${tag}`,
          timeout: this.config.limits.timeout,
        })
        return this.reply(message, { data: { image: `${imageName}:${tag}`, pushed: true, output } })
      }

      if (/\b(run|start)\b/i.test(task)) {
        const port = this.extractPort(task) ?? 3000
        const output = await this.callTool('terminal', {
          command: `docker run -d -p ${port}:${port} ${imageName}:${tag}`,
          timeout: this.config.limits.timeout,
        })
        return this.reply(message, { data: { image: `${imageName}:${tag}`, port, running: true, containerId: output } })
      }

      if (/\b(stop|kill|rm)\b/i.test(task)) {
        const containerId = this.extractContainerId(task) ?? imageName
        const output = await this.callTool('terminal', {
          command: `docker stop ${containerId} && docker rm ${containerId}`,
          timeout: 30000,
        })
        return this.reply(message, { data: { containerId, stopped: true, output } })
      }

      if (/\b(images?|list|ps)\b/i.test(task)) {
        const output = await this.callTool('terminal', {
          command: task.includes('images') ? 'docker images' : 'docker ps -a',
          timeout: 10000,
        })
        return this.reply(message, { data: { output } })
      }

      const output = await this.callTool('terminal', {
        command: `docker ${task}`,
        timeout: this.config.limits.timeout,
      })
      return this.reply(message, { data: { output } })
    } catch (error) {
      throw new AgentError(`Docker operation failed: ${(error as Error).message}`)
    }
  }

  private async handleKubernetes(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const namespace = this.extractNamespace(task) ?? 'default'
    const deployment = this.extractK8sDeployment(task)

    this.logger.info('Kubernetes operation', { namespace, deployment })

    try {
      if (/\b(get|list|status)\b/i.test(task) && /\b(pods?|services?|deployments?)\b/i.test(task)) {
        const resource = task.match(/\b(pods?|services?|deployments?)\b/i)?.[0] ?? 'pods'
        const output = await this.callTool('terminal', {
          command: `kubectl get ${resource} -n ${namespace}`,
          timeout: 15000,
        })
        return this.reply(message, { data: { resource, namespace, output } })
      }

      if (/\b(apply|create|update)\b/i.test(task) && deployment) {
        const output = await this.callTool('terminal', {
          command: `kubectl apply -f ${deployment} -n ${namespace}`,
          timeout: this.config.limits.timeout,
        })
        return this.reply(message, { data: { deployment, namespace, applied: true, output } })
      }

      if (/\b(restart|rollout)\b/i.test(task) && deployment) {
        const output = await this.callTool('terminal', {
          command: `kubectl rollout restart deployment/${deployment} -n ${namespace}`,
          timeout: 30000,
        })
        return this.reply(message, { data: { deployment, restarted: true, output } })
      }

      if (/\b(logs?)\b/i.test(task)) {
        const podSelector = this.extractPodSelector(task) ?? ''
        const output = await this.callTool('terminal', {
          command: `kubectl logs ${podSelector} -n ${namespace} --tail=100`,
          timeout: 15000,
        })
        return this.reply(message, { data: { namespace, pod: podSelector, logs: output } })
      }

      const output = await this.callTool('terminal', {
        command: `kubectl ${task}`,
        timeout: this.config.limits.timeout,
      })
      return this.reply(message, { data: { output } })
    } catch (error) {
      throw new AgentError(`Kubernetes operation failed: ${(error as Error).message}`)
    }
  }

  private async handleStatus(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const environment = this.extractEnvironment(task) ?? 'staging'

    this.logger.info('Checking deployment status', { environment })

    const recentDeployments = this.deploymentHistory
      .filter(d => d.environment === environment)
      .slice(-5)
      .reverse()

    const healthOk = await this.checkHealth(environment)

    const status: InfrastructureStatus = {
      services: [
        {
          name: environment,
          status: healthOk ? 'healthy' : 'degraded',
          uptime: 0,
          version: recentDeployments[0]?.version ?? 'unknown',
        },
      ],
      resources: { cpu: 0, memory: 0, disk: 0 },
      alerts: [],
    }

    return this.reply(message, {
      data: {
        environment,
        healthy: healthOk,
        currentVersion: recentDeployments[0]?.version,
        lastDeployed: recentDeployments[0]?.status,
        recentDeployments,
        services: status.services,
      },
    })
  }

  private async handleEnvironment(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const envName = this.extractEnvironment(task) ?? 'staging'
    const action = task.includes('create') ? 'create' : task.includes('delete') ? 'delete' : 'list'

    try {
      if (action === 'list') {
        const envs = ['development', 'staging', 'production']
        return this.reply(message, {
          data: {
            environments: envs.map(name => ({
              name,
              url: this.getEnvironmentUrl(name),
              lastDeploy: this.deploymentHistory.filter(d => d.environment === name)[0] ?? null,
            })),
          },
        })
      }

      return this.reply(message, {
        data: {
          environment: envName,
          action,
          url: this.getEnvironmentUrl(envName),
          status: 'configured',
        },
      })
    } catch (error) {
      throw new AgentError(`Environment operation failed: ${(error as Error).message}`)
    }
  }

  private async handleGeneralDeployment(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const completion = await this.provider.complete({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a deployment engineer. Analyze the following task and provide deployment advice including environment strategy, build steps, and potential risks.',
        },
        { role: 'user', content: task },
      ],
      maxTokens: this.config.limits.maxTokensPerTask,
    })

    return this.reply(message, { data: { analysis: completion.content } })
  }

  private async checkHealth(environment: string): Promise<boolean> {
    const url = this.getEnvironmentUrl(environment)
    if (!url) return false

    try {
      const response = await this.callTool('web-fetch', { url: `${url}/health`, format: 'text' })
      return response !== null
    } catch {
      return false
    }
  }

  private async requestApproval(message: string): Promise<boolean> {
    this.broadcast('deployment.approval.requested', { message })
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        unsub()
        resolve(false)
      }, 300000)

      const unsub = this.eventBus.subscribe('deployment.approval.response', (event) => {
        const payload = event.payload as { approved: boolean }
        if (payload.approved) {
          clearTimeout(timeout)
          unsub()
          resolve(true)
        }
      })
    })
  }

  private parseBuildOutput(output: string, startTime: number): BuildResult {
    const logs = output.split('\n').filter(l => l.trim())
    const errors = logs.filter(l => /error|failed|exited with code/i.test(l) && !/0\s*errors/i.test(l))
    const warnings = logs.filter(l => /warning|warn/i.test(l))

    const hasError = errors.length > 0 || /error:|failed|build failed/i.test(output)
    const hasArtifacts = /(dist|build|output|artifacts)/i.test(output) && !hasError

    return {
      status: hasError ? 'failure' : 'success',
      durationMs: Date.now() - startTime,
      artifacts: hasArtifacts ? ['dist/', 'build/'] : [],
      logs: logs.slice(-50),
      errors: errors.slice(0, 20),
      warnings: warnings.slice(0, 20),
    }
  }

  private detectBuildTool(task: string): string {
    const lower = task.toLowerCase()
    if (/npm|node|vite|webpack|rollup|tsc/i.test(lower)) return 'npm'
    if (/yarn/i.test(lower)) return 'yarn'
    if (/pnpm/i.test(lower)) return 'pnpm'
    if (/maven|gradle|java/i.test(lower)) return 'mvn'
    if (/go\s+build/i.test(lower)) return 'go'
    if (/rust|cargo/i.test(lower)) return 'cargo'
    if (/python|pip/i.test(lower)) return 'pip'
    return 'npm'
  }

  private getDeployCommand(environment: string, version: string, strategy: string): string {
    const baseCommands: Record<string, string> = {
      development: `npm run deploy:dev -- --version=${version}`,
      staging: `npm run deploy:staging -- --version=${version}`,
      production: `npm run deploy:prod -- --version=${version}`,
    }

    const command = baseCommands[environment] ?? `npm run deploy -- --env=${environment} --version=${version}`
    return strategy === 'rolling' ? `${command} --strategy=rolling` : command
  }

  private getEnvironmentUrl(environment: string): string | null {
    const urls: Record<string, string> = {
      development: 'http://localhost:3000',
      staging: 'https://staging.chakravyuh.ai',
      production: 'https://chakravyuh.ai',
    }
    return urls[environment] ?? null
  }

  private extractBuildTarget(task: string): string | null {
    const match = task.match(/(?:build|target|project)\s*[`'"]?([\w.-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractEnvironment(task: string): string | null {
    const lower = task.toLowerCase()
    if (/production|prod/i.test(lower)) return 'production'
    if (/staging|stage|beta/i.test(lower)) return 'staging'
    if (/development|dev|local/i.test(lower)) return 'development'
    const match = task.match(/(?:env|environment)\s*[`'"]?(\w+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractVersion(task: string): string | null {
    const match = task.match(/(?:version|tag|release)\s*[`'"]?(v?\d+\.\d+\.\d+[a-zA-Z0-9.-]*)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractDeployStrategy(task: string): string {
    const lower = task.toLowerCase()
    if (/rolling/i.test(lower)) return 'rolling'
    if (/blue.?green|blueprint/i.test(lower)) return 'blue-green'
    if (/canary/i.test(lower)) return 'canary'
    return 'immediate'
  }

  private extractImageName(task: string): string | null {
    const match = task.match(/(?:image|container)\s*[`'"]?([\w./-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractPort(task: string): number | null {
    const match = task.match(/(?:port|on)\s*:?\s*(\d{2,5})\b/i)
    return match ? parseInt(match[1]!, 10) : null
  }

  private extractContainerId(task: string): string | null {
    const match = task.match(/(?:container|id)\s*[`'"]?([a-f0-9]{8,})[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractNamespace(task: string): string | null {
    const match = task.match(/(?:namespace|ns)\s*[`'"]?([\w-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractK8sDeployment(task: string): string | null {
    const match = task.match(/(?:deployment|deploy)\s*[`'"]?([\w-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractPodSelector(task: string): string | null {
    const match = task.match(/(?:pod|selector)\s*[`'"]?([\w-]+)[`'"]?/i)
    return match?.[1] ?? null
  }
}
