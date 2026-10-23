export function terrainArtwork() {
  return `<svg class="terrain-art" viewBox="0 0 1000 660" preserveAspectRatio="none" aria-hidden="true">
    <defs><pattern id="grass" width="57" height="61" patternUnits="userSpaceOnUse"><path d="M13 16l2-6 3 7M41 45l2-5 2 6" fill="none" stroke="#8b9b62" stroke-width="2" opacity=".4"/></pattern></defs>
    <rect width="1000" height="660" fill="#d5cd9c"/><path d="M0 60Q180-30 360 120T700 80T1000 140V660H0Z" fill="#bdc690"/>
    <path d="M0 470Q170 370 290 500T580 490T1000 410V660H0Z" fill="#aebd82"/>
    <rect width="1000" height="660" fill="url(#grass)"/>
    <path d="M580-20Q590 120 650 210T710 390T790 690" fill="none" stroke="#e5d9b5" stroke-width="48"/>
    <path d="M580-20Q590 120 650 210T710 390T790 690" fill="none" stroke="#77776b" stroke-width="27"/>
    <path d="M580-20Q590 120 650 210T710 390T790 690" fill="none" stroke="#e8dda8" stroke-width="2" stroke-dasharray="12 18"/>
    <path d="M-20 575Q140 505 260 580T500 575T780 600T1020 535" fill="none" stroke="#7caaa9" stroke-width="24"/>
    <path d="M-20 571Q140 501 260 576T500 571T780 596T1020 531" fill="none" stroke="#bed7ce" stroke-width="3"/>
    <text x="30" y="38" class="terrain-caption">ATLANTIC FOREST • TEACHING LANDSCAPE</text>
    <text x="810" y="620" class="terrain-caption">River buffer</text>
  </svg>`;
}
