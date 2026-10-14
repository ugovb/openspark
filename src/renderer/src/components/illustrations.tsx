import type { ReactNode } from 'react'

// Shared geometry and theme tokens keep the scenes related to the app's mark.
// Decorative only: the surrounding Empty / welcome heading supplies the meaning.
const ink = 'var(--accent)'
const soft = 'var(--accent-soft)'
const paper = 'var(--surface)'
const line = 'var(--border)'
const quiet = 'var(--faint)'

function Scene({ children }: { children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="176" height="141" viewBox="0 0 180 144" fill="none"
      aria-hidden="true" focusable="false" style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
      <path d="M27 83C19 51 47 22 86 21C120 19 155 44 156 79C157 110 129 125 91 123C55 123 34 112 27 83Z" fill={soft} />
      <path d="M31 124H149" stroke={line} strokeWidth="1.5" strokeLinecap="round" />
      {children}
    </svg>
  )
}

function Letter({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={ink} strokeWidth="1.8" strokeLinejoin="round">
      <rect width="60" height="40" rx="7" fill={paper} />
      <path d="M2 3L26 20Q30 23 34 20L58 3" />
      <path d="M3 37L20 24M57 37L40 24" opacity=".25" />
    </g>
  )
}

function Octopus({ x = 0, y = 0, scale = 1, relaxed = false, mail = false }: {
  x?: number; y?: number; scale?: number; relaxed?: boolean; mail?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g stroke={ink} strokeWidth="8" strokeLinecap="round">
        <path d="M30 61C22 78 12 80 8 71M70 61C78 78 88 80 92 71" opacity=".4" />
        <path d={relaxed
          ? 'M29 53C16 41 9 47 9 56M71 53C84 41 91 47 91 56'
          : 'M30 53C18 66 6 59 9 48M70 53C82 66 94 59 91 48'} />
        <path d="M35 69C33 84 24 95 14 87M65 69C67 84 76 95 86 87M44 74C44 85 44 95 37 99M56 74C56 85 56 95 63 99" />
      </g>
      <path d="M22 46C22 23 33 10 50 10C67 10 78 23 78 46C78 65 67 77 50 77C33 77 22 65 22 46Z" fill={ink} />
      {relaxed ? (
        <path d="M34 42Q39 47 44 42M56 42Q61 47 66 42" stroke={paper} strokeWidth="2.8" strokeLinecap="round" />
      ) : (
        <g fill={paper}>
          <rect x="36" y="38" width="4.5" height="6.5" rx="2.25" />
          <rect x="59.5" y="38" width="4.5" height="6.5" rx="2.25" />
        </g>
      )}
      <path d="M46 50Q50 54 54 50" stroke={paper} strokeWidth="1.8" strokeLinecap="round" />
      {mail && <Letter x={26} y={57} scale={0.8} />}
    </g>
  )
}

export function InboxZero() {
  return (
    <Scene>
      <ellipse cx="85" cy="118" rx="43" ry="5" fill={line} opacity=".5" />
      <g transform="rotate(-8 83 80)"><Octopus x={33} y={20} relaxed /></g>
      <g transform="rotate(9 133 104)"><Letter x={110} y={91} scale={0.64} /></g>
      <circle cx="136" cy="36" r="14" fill={paper} stroke={line} strokeWidth="1.5" />
      <path d="M129 36L134 41L143 31" stroke={ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 34H35M31.5 30.5V37.5" stroke={quiet} strokeWidth="1.5" strokeLinecap="round" />
    </Scene>
  )
}

export function NoSelection() {
  return (
    <Scene>
      <g transform="rotate(-9 77 69)">
        <rect x="39" y="30" width="86" height="78" rx="10" fill="var(--surface-2)" stroke={line} strokeWidth="1.5" />
      </g>
      <rect x="51" y="35" width="89" height="80" rx="10" fill={paper} stroke={line} strokeWidth="1.5" />
      <circle cx="64" cy="47" r="2.5" fill={ink} />
      <path d="M74 47H96M108 47H126" stroke={quiet} strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <Letter x={66} y={61} scale={0.94} />
      <path d="M132 91L133 119L140 111L151 109Z" fill={ink} stroke={paper} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="32" cy="81" r="3" fill={ink} opacity=".3" />
    </Scene>
  )
}

export function NoResults() {
  return (
    <Scene>
      <path d="M35 65V49Q35 42 42 42H62L71 51H125Q132 51 132 58V109H35Z" fill="var(--surface-2)" stroke={line} strokeWidth="1.5" strokeLinejoin="round" />
      <Octopus x={52} y={34} scale={0.67} />
      <path d="M30 73Q29 68 35 68H69L76 74H134Q139 74 138 79L131 113Q130 118 124 118H45Q39 118 38 113Z" fill={paper} stroke={line} strokeWidth="1.5" />
      <path d="M51 94H70" stroke={quiet} strokeWidth="2" strokeLinecap="round" />
      <circle cx="122" cy="81" r="20" fill={soft} stroke={ink} strokeWidth="2.5" />
      <path d="M137 96L151 111" stroke={ink} strokeWidth="6" strokeLinecap="round" />
      <path d="M112 77Q116 69 124 70" stroke={paper} strokeWidth="3" strokeLinecap="round" />
    </Scene>
  )
}

export function NoDrafts() {
  return (
    <Scene>
      <g transform="rotate(-7 84 75)">
        <path d="M60 27H104L119 42V111Q119 117 113 117H60Q54 117 54 111V33Q54 27 60 27Z" fill={paper} stroke={line} strokeWidth="1.5" />
        <path d="M103 28V43H118" fill="var(--surface-2)" stroke={line} strokeWidth="1.5" strokeLinejoin="round" />
        <Letter x={67} y={47} scale={0.5} />
        <path d="M67 81H104M67 90H98M67 99H84" stroke={quiet} strokeWidth="2" strokeLinecap="round" opacity=".6" />
      </g>
      <g transform="rotate(32 127 84)">
        <rect x="122" y="50" width="10" height="56" rx="3" fill={ink} />
        <path d="M122 104L127 116L132 104" fill={paper} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M123 60H131" stroke={paper} strokeWidth="2" />
      </g>
      <path d="M30 62H37M33.5 58.5V65.5" stroke={quiet} strokeWidth="1.5" strokeLinecap="round" />
    </Scene>
  )
}

export function NoScheduled() {
  return (
    <Scene>
      <circle cx="103" cy="67" r="40" fill={paper} stroke={line} strokeWidth="1.5" />
      <circle cx="103" cy="67" r="32" stroke={line} strokeWidth="1.5" strokeDasharray="1 7.38" />
      <path d="M103 44V67L120 77" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="103" cy="67" r="3.5" fill={ink} />
      <g transform="rotate(-8 60 97)"><Letter x={31} y={78} scale={1.02} /></g>
      <path d="M140 109H146M143 106V112" stroke={quiet} strokeWidth="1.5" strokeLinecap="round" />
    </Scene>
  )
}

export function NoContact() {
  return (
    <Scene>
      <g transform="rotate(7 97 75)">
        <rect x="59" y="32" width="79" height="83" rx="9" fill="var(--surface-2)" stroke={line} strokeWidth="1.5" />
      </g>
      <rect x="42" y="33" width="86" height="84" rx="9" fill={paper} stroke={line} strokeWidth="1.5" />
      <path d="M128 48H133Q136 48 136 51V59Q136 62 133 62H128M128 69H133Q136 69 136 72V80Q136 83 133 83H128" fill={ink} opacity=".7" />
      <circle cx="85" cy="63" r="21" fill={soft} />
      <Octopus x={66} y={44} scale={0.38} />
      <path d="M67 96H103M74 104H96" stroke={quiet} strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <path d="M38 52H47M38 71H47M38 90H47" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <circle cx="148" cy="88" r="3" fill={ink} opacity=".3" />
    </Scene>
  )
}

export function Welcome() {
  return (
    <Scene>
      <ellipse cx="90" cy="119" rx="45" ry="5" fill={line} opacity=".5" />
      <Octopus x={40} y={20} mail />
      <g transform="rotate(-17 34 54)"><Letter x={19} y={43} scale={0.48} /></g>
      <g transform="rotate(14 145 47)"><Letter x={131} y={37} scale={0.44} /></g>
      <path d="M135 86Q148 78 148 66M41 31Q48 24 58 24" stroke={quiet} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 5" />
      <circle cx="120" cy="21" r="3" fill={ink} opacity=".4" />
    </Scene>
  )
}

export function AskAI() {
  return (
    <Scene>
      <Octopus x={31} y={39} scale={0.79} mail />
      <path d="M103 25H147Q154 25 154 32V65Q154 72 147 72H117L102 83L105 72H103Q96 72 96 65V32Q96 25 103 25Z" fill={paper} stroke={line} strokeWidth="1.5" strokeLinejoin="round" />
      <Letter x={108} y={35} scale={0.42} />
      <g fill={ink}><circle cx="113" cy="62" r="1.8" /><circle cx="121" cy="62" r="1.8" /><circle cx="129" cy="62" r="1.8" /></g>
      <path d="M145 84Q145 96 157 96Q145 96 145 108Q145 96 133 96Q145 96 145 84Z" fill={ink} />
      <circle cx="35" cy="36" r="3" fill={ink} opacity=".3" />
    </Scene>
  )
}

/** "Nothing left" scene: a calm lake landscape in flat colour layers, cut into a circle that floats over the
 *  page. 240px, 180px on phones. Colours come from the --art-* tokens (light and dark variants). */
export function AllDone() {
  return (
    <div className="h-[240px] w-[240px] shrink-0 overflow-hidden rounded-full max-md:h-[180px] max-md:w-[180px]" style={{ boxShadow: 'var(--shadow)' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
        <rect width="240" height="240" fill="var(--art-sky)" />
        <circle cx="158" cy="96" r="26" fill="var(--art-sun)" />
        <g fill="var(--art-cloud)">
          <rect x="44" y="66" width="58" height="14" rx="7" />
          <circle cx="62" cy="66" r="10" />
          <circle cx="80" cy="62" r="13" />
          <rect x="168" y="58" width="38" height="10" rx="5" />
          <circle cx="184" cy="58" r="8" />
        </g>
        <path d="M92 100Q96 95 100 100Q104 95 108 100M114 86Q117 82.5 120 86Q123 82.5 126 86" stroke="var(--art-bird)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M0 146C28 128 52 122 78 131C100 139 118 116 146 112C172 108 198 126 240 118V240H0Z" fill="var(--art-hill-1)" />
        <path d="M0 162C24 149 46 145 70 153C94 161 112 141 140 139C168 137 188 155 240 145V240H0Z" fill="var(--art-hill-2)" />
        <rect y="172" width="240" height="68" fill="var(--art-lake)" />
        <path d="M0 172H240V179C196 177 172 184 140 186C112 188 96 178 70 182C46 186 24 180 0 178Z" fill="var(--art-hill-2)" opacity=".35" />
        <g fill="var(--art-glint)">
          <rect x="139" y="180" width="38" height="3" rx="1.5" />
          <rect x="146" y="188" width="24" height="3" rx="1.5" />
          <rect x="152" y="196" width="12" height="3" rx="1.5" />
        </g>
        <path d="M110 194V176L122 194Z" fill="var(--art-sail)" />
        <path d="M98 196H126L121 202H103Z" fill="var(--art-hill-3)" />
        <path d="M0 198C30 187 62 191 90 207C108 217 120 229 127 240H0Z" fill="var(--art-hill-3)" />
        <path d="M240 205C216 203 197 213 186 240H240Z" fill="var(--art-hill-3)" />
      </svg>
    </div>
  )
}
