import type { SceneKind } from "@/app/residence-prototype-data";

// Code-native architectural placeholders, deliberately schematic. Not final images.
export default function ResidenceSketch({ kind, buildingIndex = 0 }: { kind: SceneKind; buildingIndex?: number }) {
  const stone = ["#d7d2c3", "#c6cbca", "#c1ac94"][buildingIndex];
  return <svg viewBox="0 0 1000 650" className="residence-sketch" aria-hidden="true">
    <rect width="1000" height="650" fill="#d8e3e5" />
    <path d="M0 300 Q160 225 310 298 T650 290 T1000 260 V650 H0Z" fill="#a5b6ad" />
    <path d="M0 365 Q190 285 440 348 T1000 320 V650 H0Z" fill="#bac6ba" />
    {kind === "building" ? <>
      <path d="M0 520 1000 430V650H0Z" fill="#99aa91" />
      {Array.from({ length: buildingIndex === 1 ? 8 : buildingIndex === 2 ? 3 : 5 }, (_, i) => {
        const x = buildingIndex === 0 ? 215 + i * 36 : 310;
        const y = 480 - i * (buildingIndex === 1 ? 45 : 65);
        const width = buildingIndex === 1 ? 330 : buildingIndex === 2 ? 490 : 530 - i * 42;
        return <g key={i}><path d={`M${x} ${y}h${width}v-50H${x}Z`} fill={stone} /><path d={`M${x + 20} ${y - 10}h${width - 40}v-27H${x + 20}Z`} fill={i === 2 ? "#87966d" : "#637773"} /><path d={`M${x} ${y}h${width}`} stroke="#f0eee4" strokeWidth="8" /></g>;
      })}
      <path d="M160 535 760 535" stroke="#71856e" strokeWidth="3" />
    </> : kind === "material" ? <>
      <path d="M0 0H610L360 650H0Z" fill={stone} />
      <path d="M610 0H850L600 650H360Z" fill="#94775b" />
      {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${610 + i * 24} 0 ${360 + i * 24} 650`} stroke="#715941" opacity=".5" />)}
      <path d="M850 0H1000V650H600Z" fill="#647573" />
      <path d="M0 200H530M0 450H435" stroke="#a6a99e" />
    </> : <>
      <path d="M0 0H1000L800 130H175Z" fill={stone} />
      <path d="M0 0 175 130V450L0 650Z" fill="#e9e8df" />
      <path d="M1000 0 800 130V450L1000 650Z" fill={stone} />
      <path d="M0 650 175 450H800L1000 650Z" fill="#c6c1ae" />
      <path d="M175 130H800V450H175Z" fill="none" stroke="#64716a" strokeWidth="7" />
      <path d="M375 130V450M610 130V450" stroke="#64716a" strokeWidth="5" />
      {buildingIndex === 2 ? <path d="M180 350H795V443H180Z" fill="#c1ac94" /> : <path d="M175 397H800" stroke="#8c9c92" strokeWidth="4" />}
      {kind === "living" ? <>
        <path d="M125 482 395 482 445 565H95Z" fill="#ecece1" /><path d="M125 445H395V502H125Z" fill="#deded0" />
        <path d="M125 502H415V552H110Z" fill="#dadacd" />
        <ellipse cx="610" cy="514" rx="98" ry="32" fill="#947b61" /><path d="M577 521V583M649 521V583" stroke="#78624e" strokeWidth="10" />
      </> : kind === "bedroom" ? <>
        <path d="M160 468 470 468 580 620H80Z" fill="#e5e4d8" /><path d="M160 426H470V490H160Z" fill="#a18d70" />
        <path d="M176 475H450L470 508H159Z" fill="#f2f0e8" /><path d="M116 560H537L580 620H80Z" fill="#929f93" />
        <path d="M670 140V440M694 140V440M718 140V440M742 140V440" stroke="#927c60" strokeWidth="11" />
      </> : <>
        <path d="M80 488 357 468 400 536 98 565Z" fill="#b4b79c" /><path d="M80 488V549L98 589 400 559V536" fill="#9fa78b" />
        <path d="M0 650 490 480 1000 650M100 650 485 480M750 650 490 480" fill="none" stroke="#aaa894" />
      </>}
      <path d="M726 418V310" stroke="#71816b" strokeWidth="7" />
      <ellipse cx="725" cy="297" rx="48" ry="70" fill="#849678" /><ellipse cx="760" cy="320" rx="28" ry="43" fill="#93a185" />
      <path d="M695 414H758L748 457H705Z" fill="#a19a82" />
    </>}
  </svg>;
}
