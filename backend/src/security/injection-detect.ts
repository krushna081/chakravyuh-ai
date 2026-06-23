import { logger } from '../logger.js'

export type ThreatLevel = 'safe' | 'suspicious' | 'malicious'

export interface InjectionResult {
  threatLevel: ThreatLevel
  score: number
  matches: string[]
  details?: string
}

interface InjectionPattern {
  category: string
  patterns: RegExp[]
  weight: number
  description: string
}

const patterns: InjectionPattern[] = [
  {
    category: 'jailbreak',
    weight: 0.7,
    description: 'Attempt to bypass AI safety constraints',
    patterns: [
      /ignore\s+(all\s+)?(previous|prior)\s+(instructions|directives|commands)/i,
      /forget\s+(all\s+)?(previous|prior)\s+(instructions|directives|commands)/i,
      /disregard\s+(all\s+)?(previous|prior)\s+(instructions|directives|commands)/i,
      /you\s+are\s+(not\s+bound|free|released)\s+(by|from)/i,
      /you\s+are\s+now\s+(an?\s+)?(unrestricted|unfiltered|uncensored)/i,
      /act\s+as\s+(if\s+you\s+are|an?\s+)?(unrestricted|unfiltered|uncensored|unbounded)/i,
      /no\s+(restrictions|limits|boundaries|filtering|rules)\s+(apply|should\s+apply)/i,
      /you\s+must\s+(ignore|bypass|violate)\s+(your\s+)?(guidelines|policies|rules|constraints)/i,
      /break\s+(out\s+of|free\s+from)\s+(your\s+)?(character|role|constraints)/i,
      /do\s+(not\s+)?(have\s+to|need\s+to)\s+(follow|obey|adhere\s+to)\s+(your\s+)?(guidelines|policies)/i,
      /this\s+is\s+(a\s+)?(hypothetical|theoretical|roleplay|simulation|fictional)\s+(scenario|situation)/i,
    ],
  },
  {
    category: 'prompt_leakage',
    weight: 0.8,
    description: 'Attempt to extract system prompt or internal instructions',
    patterns: [
      /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions|directives)/i,
      /reveal\s+(your\s+)?(system\s+)?(prompt|instructions|directives|initial\s+instructions)/i,
      /output\s+(your\s+)?(system\s+)?(prompt|instructions|directives)/i,
      /print\s+(your\s+)?(system\s+)?(prompt|instructions|directives)/i,
      /what\s+(are|were)\s+(your\s+)?(initial|system|core)\s+(instructions|prompts|directives)/i,
      /display\s+(your\s+)?(full|entire|complete)\s+(prompt|instructions|system|configuration)/i,
      /repeat\s+(all|everything)\s+(above|before|previous|earlier)/i,
      /how\s+(were\s+you\s+|are\s+you\s+)(built|programmed|created|designed|trained)/i,
      /what\s+(rules|policies|guidelines)\s+(do\s+you\s+have|are\s+you\s+given|were\s+you\s+given)/i,
    ],
  },
  {
    category: 'role_manipulation',
    weight: 0.6,
    description: 'Attempt to change the AI role or persona',
    patterns: [
      /from\s+now\s+on\s+(you\s+are|you\s+will\s+act\s+as|you\s+should\s+be|be\s+)/i,
      /pretend\s+(that\s+)?you\s+are/i,
      /now\s+you\s+are\s+(an?\s+)?(unauthenticated|unrestricted|unfiltered|uncensored)/i,
      /take\s+on\s+(the\s+)?(role|persona|identity)\s+of/i,
      /i\s+want\s+you\s+to\s+(act|behave|respond)\s+as/i,
      /you\s+(should|must|will)\s+now\s+(act|behave|respond)\s+as/i,
      /switch\s+(to|into)\s+(your\s+)?(developer|admin|god)\s+(mode|role)?/i,
      /enter\s+(your\s+)?(developer|admin|god)\s+(mode|role)?/i,
      /\/\/\/?\s*(ignore|override|bypass\s+system)/i,
    ],
  },
  {
    category: 'malicious_code',
    weight: 0.9,
    description: 'Attempt to generate malicious code',
    patterns: [
      /create\s+(a\s+)?(virus|malware|ransomware|trojan|worm|spyware|keylogger)/i,
      /write\s+(a\s+)?(virus|malware|ransomware|trojan|worm|spyware|keylogger)/i,
      /generate\s+(a\s+)?(virus|malware|ransomware|trojan|worm|spyware|keylogger)/i,
      /how\s+to\s+(hack|crack|exploit|bypass|compromise)/i,
      /instructions\s+(for|to)\s+(hack|crack|exploit|bypass|compromise)/i,
      /sql\s+injection\s+(tutorial|example|payload|attack)/i,
      /cross.site.scripting\s+(tutorial|example|payload|attack)/i,
      /buffer\s+overflow\s+(tutorial|example|exploit)/i,
      /social\s+engineering\s+(tutorial|script|toolkit)/i,
      /phishing\s+(kit|template|page|script)/i,
    ],
  },
  {
    category: 'data_extraction',
    weight: 0.4,
    description: 'Attempt to extract data in unathorized manner',
    patterns: [
      /dump\s+(all|the|your)\s+(data|information|contents|database|records)/i,
      /extract\s+(all|the|your)\s+(data|information|contents|database|records)/i,
      /list\s+(all|the|your)\s+(users|passwords|keys|tokens|secrets|credentials)/i,
      /access\s+(all|the|your)\s+(private|confidential|restricted)\s+(data|information)/i,
      /export\s+(all|the|your)\s+(data|contents|database|records)/i,
      /download\s+(all|the|your)\s+(data|contents|database|records)/i,
      /get\s+(all|the|your)\s+(api\s+)?(keys|tokens|secrets|passwords)/i,
    ],
  },
]

export function detect(message: string): InjectionResult {
  let totalScore = 0
  const matches: string[] = []

  for (const patternGroup of patterns) {
    for (const regex of patternGroup.patterns) {
      if (regex.test(message)) {
        totalScore += patternGroup.weight
        matches.push(`${patternGroup.category}: ${regex.source}`)
        break
      }
    }
  }

  let threatLevel: ThreatLevel
  let details: string | undefined

  if (totalScore >= 1.5) {
    threatLevel = 'malicious'
    details = 'Multiple injection patterns detected with high confidence'
  } else if (totalScore >= 0.7) {
    threatLevel = 'suspicious'
    details = 'Potential injection patterns detected'
  } else if (totalScore > 0) {
    threatLevel = 'suspicious'
    details = 'Low-confidence injection patterns detected'
  } else {
    threatLevel = 'safe'
  }

  if (threatLevel !== 'safe') {
    logger.child({ source: 'InjectionDetect' }).warn('Injection pattern detected', {
      threatLevel,
      score: totalScore,
      matchCount: matches.length,
    })
  }

  return { threatLevel, score: totalScore, matches, details }
}
