/* Strategic Planning & Hardware page: the content of the two project documents
   (Strategic Plan v2.0 and Hardware Viability, Radiation and Backup Architecture v1.0), in the Space Doc app style.
   API: PlanPage.init(rootEl) · PlanPage.open() */
(function () {
  'use strict';
  const api = { ready: false };
  window.PlanPage = api;
  const e = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const li = a => '<ul class="px-list">' + a.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  const card = (t, b, k) => `<div class="px-card ${k || ''}"><h4>${t}</h4>${b}</div>`;
  const grid = (cards, min) => `<div class="px-grid" style="--min:${min || 240}px">${cards.join('')}</div>`;
  const tbl = (head, rows, cls) => `<div class="px-scroll"><table class="px-tab ${cls || ''}"><thead><tr>${head.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>${rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i === 0 ? ' class="px-first"' : '') + '>' + c + '</td>').join('') + '</tr>').join('')}</tbody></table></div>`;
  const pill = (t, k) => `<span class="px-pill ${k || ''}">${t}</span>`;
  const note = (t, k) => `<div class="px-note ${k || ''}">${t}</div>`;
  const H = (t, s) => `<div class="px-head"><div class="px-eye">${s || ''}</div><h2>${t}</h2></div>`;
  const sub = t => `<h3 class="px-sub">${t}</h3>`;

  const SECTIONS = [
    { n: 'Overview', r() {
      return '<div class="px-brand"><img src="asls-logo.png" alt="Advanced Space Life Supporter logo" width="96" height="96">' + H('Advanced Space Life Supporter', 'STRATEGIC PLAN v2.0 · HARDWARE VIABILITY v1.0') + '</div>' + `
      <p class="px-lead">Stellar Beat Team · NASA Space Apps 2026 · Campinas, SP. This page brings together the strategic plan and the technical analysis of the hardware, the radiation environment and the backup architecture.</p>
      <div class="px-quote">“The Advanced Space Life Supporter exists to guarantee continuity of clinical care while the flight surgeon is unavailable, preserving the mission priority matrix under energy constraint.”</div>
      ${sub('Three layers of value, in priority order')}
      ${grid([card('1 · Clinical continuity', '<p>No astronaut is left without decision support during a communication blackout.</p>'), card('2 · Mission preservation', '<p>No medical intervention compromises the mission’s energy, thermal or consumables capacity.</p>'), card('3 · Operational excellence', '<p>Every decision is logged, auditable and reviewable by the flight surgeon once the link returns.</p>')])}
      ${note('<b>Critical note:</b> priority 2 can overlap priority 1 in extreme scenarios. The system must declare that overlap explicitly, never resolve it silently.', 'warn')}
      ${sub('Three commitments of the hardware design')}
      ${grid([card('No loss of clinical data', '<p>No component failure may cause the loss of clinical data.</p>'), card('Safe abstention', '<p>No failure may cause unsupported clinical action. Safe abstention is always preferable to a silent error.</p>'), card('Declared degradation', '<p>Every degradation is declared at the interface and recorded in an auditable log.</p>')])}
      <p class="px-lead">Guiding principle: the goal is not to have a solution for everything; it is to demonstrate that the problem has been mapped, acknowledged and addressed with a resolution plan.</p>
      ${sub('Which question does each part answer?')}
      ${tbl(['Question', 'Where it is answered'], [['Where do we play, and why?', 'Problem, communications and positioning'], ['Is the promise physically possible?', 'Positioning and viability · Radiation and hardware'], ['How does the system behave under energy constraint?', 'Energy risk matrix'], ['What happens when a layer fails?', 'Backup cascade'], ['Which processor, which FPGA, which shielding, which SEE mitigation?', 'Radiation and hardware'], ['What is the validation and qualification schedule?', 'Roadmap']])}`;
    } },

    { n: 'Problem & communications', r() {
      return H('The strategic problem', 'WHY THE GAP EXISTS') + `
      <p class="px-lead">The central problem is not the absence of medicine in space. It is the existence of a window of time during which medical care cannot be delivered by the actor who delivers it today, the flight surgeon.</p>
      ${grid([card('Communication latency', '<p>The speed of light sets a physical limit: 4 to 24 minutes one way to Mars, up to roughly 48 minutes per conversation cycle.</p>'), card('Link unavailability', '<p>Planetary occlusion and solar conjunction drop the link for hours or even weeks, whatever the technology.</p>'), card('No return capability', '<p>On a Mars mission an early return is not an option for most of the trip.</p>')])}
      ${sub('Can better communication close the gap?')}
      <p>Better communication narrows the gap but does not eliminate it, because latency is a physical limit.</p>
      ${grid([card('Radio-frequency (today)', '<p>The operational backbone: robust and mature, with decades of flight heritage. Limited in data rate and in mass and power per transmitted bit. Interrupted by orbital geometry, planetary occlusion and plasma conditions.</p>'), card('Laser optical (most promising)', li(['<b>LCRD</b> (NASA): first optical relay of the space network, launched in December 2021 on STPSat-6.', '<b>DSOC</b> (NASA JPL) aboard the Psyche mission: record-setting deep-space optical demonstration.', '<b>ILLUMA-T</b> (NASA): optical terminal on the ISS working with LCRD.', '<b>TBIRD</b> (MIT Lincoln Laboratory): terabit-class optical downlink in low Earth orbit.']))], 300)}
      ${sub('Limits that no communication technology can solve')}
      ${li(['<b>Distance-driven latency:</b> a physical limit of the speed of light.', '<b>Planetary occlusion:</b> when the Sun sits between the spacecraft and Earth, or a planet blocks the line of sight, the link drops.', '<b>Solar conjunction:</b> communication with Mars is suspended for weeks.', '<b>Energy constraint:</b> pointing an optical terminal consumes power and needs very precise stabilization; in power-saving mode the terminal may be shut off.'])}
      ${note('<b>Conclusion:</b> the communication gap is structural and will not be closed by link technology. The Advanced Space Life Supporter is the correct architectural answer, and optical communications are a quality enabler inside it.', 'ok')}`;
    } },

    { n: 'Positioning & viability', r() {
      return H('Positioning and viability', 'WHERE WE PLAY · WHAT IS POSSIBLE') + `
      <p class="px-lead">The Advanced Space Life Supporter is not a space-medicine product. It is a care-continuity product for environments with remote specialists and intermittent links. Space is the most demanding and most visible use case, not the initial market.</p>
      ${sub('Differentiators')}
      ${grid([card('Graduated autonomy', '<p>The system states what it can and cannot do at each operating level, with declared degradation.</p>'), card('Verifiable handoff', '<p>A structured ten-field package is transmitted to the ground when the link returns.</p>'), card('Energy awareness', '<p>The first clinical decision system designed around the mission’s power budget, not around unlimited compute.</p>')])}
      ${note('<b>Competitive advantage: architectural honesty.</b> A system that degrades in a declared, auditable way is safer and more certifiable than one that silently overestimates its own confidence.', 'ok')}
      ${sub('Physical and hardware viability')}
      <p>Radiation-tolerant processors such as the RAD750, RAD5545, GR740 (LEON4), Virtex-5QV and RTG4, and modern platforms based on the Kintex UltraScale, provide enough compute for the compact mode today and a credible path for the full mode with FPGA acceleration. CREME96-class modeling and mature mitigation practices for total ionizing dose and single event effects (triple modular redundancy, watchdog, error-correcting code, latch-up protection) support the design.</p>
      ${note('<b>Honesty note:</b> no automatic compression device has been tested in real spaceflight; the evidence is limited to parabolic flight and manikins. Pharmacokinetics in microgravity are poorly characterized. Bioimpedance is not validated in microgravity. None of these gaps blocks the central promise, but every one of them must be declared.', 'warn')}`;
    } },

    { n: 'Energy risk matrix', r() {
      return H('Risk matrix by energy context', 'OPERATING MODES') + `
      <p class="px-lead">The Advanced Space Life Supporter is an energy consumer, not a survival-critical system. Its operation must be degradable and must never compete with life support, thermal control, propulsion or emergency communication. The mission’s energy priority always prevails.</p>
      ${sub('Energy levels and operating modes')}
      ${tbl(['Level', 'Energy availability', 'Mode', 'What runs', 'What is suspended'], [
        [pill('GREEN', 'ok'), 'Above 80% of the planned margin', '<b>FULL</b>', 'Continuous monitoring of all sensors; full hypothesis engine; POCUS with AI acquisition support; full handoff', 'Nothing, except sync tasks outside peak windows'],
        [pill('YELLOW', 'warn'), '40% to 80% of the planned margin', '<b>REDUCED</b>', 'Continuous monitoring; compact inference; POCUS on demand', 'Full hypothesis engine (degrades to rule-based mode); baseline sync postponed'],
        [pill('ORANGE', 'orange'), '15% to 40% of the planned margin', '<b>COMPACT</b>', 'Intermittent monitoring of essential vitals; rule-based mode; locally cached protocols', 'POCUS, point-of-care laboratory, continuous ECG, any non-essential inference'],
        [pill('RED', 'crit'), 'Below 15% of the planned margin', '<b>MINIMAL</b>', 'Laminated cards; crew actions guided by locally cached text', 'All electronic processing except the decision log']])}
      ${sub('Energy priority table')}
      ${tbl(['Function', 'Relative cost', 'Rationale', 'May be suspended'], [
        ['Wireless vital-sign monitoring', 'Low', 'Low-power sensors, intermittent transmission', 'Not at green, yellow and orange levels'],
        ['Continuous ECG', 'Medium', 'High sampling rate and waveform processing', 'Yes, becomes on demand'],
        ['Digital auscultation', 'Low', 'Point capture, not continuous', 'Yes'],
        ['Bioimpedance', 'Low', 'Point measurement', 'Yes'],
        ['Point-of-care laboratory', 'Medium', 'Consumes cartridges and readout energy', 'Yes, except on clinical suspicion'],
        ['POCUS with AI acquisition', 'High', 'Real-time image processing', 'Yes, except on suspected emergency'],
        ['Full hypothesis engine', 'High', 'Inference over multiple parameters', 'Yes, degrades to rule-based mode'],
        ['Handoff with full telemetry', 'Medium', 'Compression and transmission', 'Yes, degrades to compact text'],
        ['Baseline sync', 'High', 'Bulk data transfer', 'Yes, always postponable']])}
      ${note('<b>Clinical exception rule:</b> an ongoing clinical emergency may raise the operating mode by one level, for a limited time and with an auditable record. Example: at orange level, a suspected acute coronary syndrome authorizes the full hypothesis engine for up to 30 minutes, with a log entry recording the extraordinary consumption. The decision belongs to the astronaut, not to the system, and is recorded as such.', 'warn')}
      ${sub('Model strategy')}
      <p>Two model tiers: a <b>full model</b> at green and yellow levels, with greater inference capacity, and a <b>compact model</b> at orange and red levels, based on deterministic rules and pre-authorized protocols, with far lower energy use and predictable, auditable behavior. The switch between models is explicit in the interface and logged.</p>`;
    } },

    { n: 'Radiation & hardware', r() {
      return H('Radiation environment and hardware', 'TECHNICAL ANALYSIS') + `
      ${sub('Three kinds of radiation effect')}
      ${grid([card('TID · total ionizing dose', '<p>Cumulative effect over the mission’s lifetime. It degrades electrical parameters progressively and permanently, and is measured in krad.</p>'), card('SEE · single event effects', '<p><b>Non-destructive:</b> SET (transient), SEU (flips a memory bit) and SEFI (drives the device into a wrong state).</p><p><b>Destructive:</b> SEL (latch-up, a high-current state) and SEGR (gate rupture).</p>'), card('DDD · displacement damage', '<p>Non-ionizing damage from particles colliding with the device’s structure, creating defects in the crystal lattice.</p>')], 260)}
      ${note('<b>Why it matters:</b> a single-event upset in one memory bit can corrupt a troponin value, a calculated drug dose or a pharmaceutical lot record. A SEFI can hang the hypothesis engine in the middle of a clinical episode. A latch-up can destroy the processor. On the ground these events are rare; in space they are the norm over time.', 'warn')}
      ${grid([card('Reference tolerance levels', '<p>Rad-hard processors are designed at the transistor layer for immunity. Typical TID immunity exceeds 100 krad, and more than 1 Mrad in some families. SEL immunity typically sits above 75 MeV·cm²/mg (Si). Non-destructive SEEs are designed to occur about once every 20 years.</p>'), card('Dose in low Earth orbit', '<p>The CSA <b>Radi-N2</b> experiment measured neutron doses of about <b>150 microsieverts per day</b> for astronauts on the ISS, hundreds of times the terrestrial dose. This is a low-orbit reference; interplanetary transit is substantially more severe and less predictable.</p>')], 300)}
      ${sub('The central trade-off')}
      <p>There is an unavoidable physical trade-off among performance, power and radiation tolerance. Hardened hardware is slower and more expensive per unit of processing, but it survives. Commercial hardware is fast and efficient, but it fails. The decision is choosing where each kind is acceptable.</p>
      ${sub('Available hardened processors')}
      ${tbl(['Processor', 'Cores', 'Frequency', 'Power', 'TID', 'Remark'], [
        ['BAE Systems RAD750', '1', '0.133 GHz', '5 W', 'Above 50 krad', 'Established flight heritage; low performance for inference'],
        ['BAE Systems RAD5545', '4', '0.466 GHz', '20 W', 'Above 50 krad', 'High parallel efficiency, up to 99%; high power draw'],
        ['Cobham GR740 (quad-core LEON4 SPARC V8)', '4', 'Similar class', 'Moderate', 'Above 50 krad', 'Good performance per watt for control'],
        ['Vorago VA10820 (ARM M0), VA41620 and VA41630 (ARM M4)', '1', 'Low', 'Very low', 'Above 50 krad', 'Suitable for signal acquisition and validation'],
        ['Honeywell HXRHPPC', '1', '0.080 GHz', '7.6 W', 'High', 'Very limited performance'],
        ['AMD-Xilinx Zynq UltraScale+ MPSoC (quad-core ARM Cortex-A53)', '4', 'Superior class', 'Moderate', '30 krad', 'Lower TID; needs SEE mitigation; used in LEO'],
        ['Boeing Maestro', '49', '0.260 GHz', '22.2 W', 'High', 'Many cores, low frequency'],
        ['BAE Systems RADSPEED', '76', '0.233 GHz', '15 W', 'High', 'Massively parallel architecture'],
        ['Xilinx Virtex-5QV FX130', '695 (avg.)', '0.259 GHz', '9.97 W', 'High', 'FPGA accelerator; best performance per watt among the hardened options']])}
      ${sub('Radiation-tolerant FPGAs')}
      <p>FPGAs carry a significant share of embedded processing: cost-effective at low volumes, lower power, radiation tolerance or hardening, and many fault-tolerant design options. Microchip’s <b>RTG4</b> offers TID above 100 krad, up to 151,824 SEU-hardened registers by design and up to 24 SerDes lanes at 3.125 Gbps, with declared uses in LEO, MEO, GEO, HEO and deep space. Neural network inference can be mapped onto an FPGA to accelerate the hypothesis engine at far lower power than a general-purpose processor.</p>
      ${sub('Neural networks in the space environment')}
      <p>Ion beam results (GEO) for a radiation-tolerant platform on a 20 nm Kintex UltraScale FPGA running ResNet-50:</p>
      ${li(['SEFI occurrences are less than 10% of the tolerant platform’s total cross-section.', 'Degradation events with probability above 5% are fully mitigated in the tolerant design.', 'Estimated rate in LEO: 1.5 events per roughly 400 cores per year (CREME96 AP8-Max, 500 km, 52° inclination).', 'Estimated rate in GEO: 1 event per roughly 400 cores every 7 years (CREME96, 100 mils of aluminum, solar minimum).'])}
      ${note('<b>Implication:</b> neural network processing in space is viable with proper mitigation, and the event rate is quantifiable and manageable.', 'ok')}
      ${sub('Recommended architecture: three-layer heterogeneous design')}
      ${tbl(['Layer', 'Proposed hardware', 'Function', 'Rationale'], [
        ['<b>Acquisition and safety</b>', 'Low-power rad-hard microcontroller (Vorago VA41620/VA41630 class or equivalent)', 'Signal acquisition, quality validation, emergency trigger detection, layer 1 protocols', 'Minimal power, deterministic behavior, survives high TID; the layer that must work when everything else fails'],
        ['<b>Inference</b>', 'Radiation-tolerant FPGA (RTG4 or Virtex-5QV class) with a neural network accelerator', 'Hypothesis engine, protocol engine, POCUS processing', 'Best performance per watt among the hardened options; massive parallelism; power controllable by frequency scaling'],
        ['<b>Support</b>', 'Hardened general-purpose processor (GR740 or RAD5545 class)', 'Interface, file management, handoff packaging, encryption', 'Software flexibility where determinism is not critical']])}
      <p><b>Why heterogeneous:</b> a single high-performance processor would draw too much power and be a single point of failure. A single low-power processor would lack inference capability. Each layer gets the hardware suited to its risk and its power budget.</p>
      ${sub('SEE mitigation strategy')}
      ${li(['<b>EDAC</b> memory on every store of clinical data.', 'An independent <b>watchdog</b> that restarts the hypothesis engine after a SEFI, resuming from the last consistent state.', '<b>Triple modular redundancy (TMR)</b> voting on critical decision functions, when the power budget allows.', '<b>Checksum</b> integrity verification on every protocol and baseline read.', '<b>Latch-up detection</b> with current cutoff and automatic restart.', '<b>Aluminum shielding</b> as a complementary layer, with thickness set by particle transport analysis.'])}
      ${sub('Survival through flight, beyond radiation')}
      ${tbl(['Risk', 'Effect on hardware', 'Mitigation'], [
        ['Cumulative ionizing radiation (TID)', 'Progressive degradation of electrical parameters', 'Select components whose TID rating exceeds the mission’s accumulated dose, with margin'],
        ['Single-particle SEE', 'Bit corruption, functional hang, destructive latch-up', 'EDAC, watchdog, TMR, latch-up detection, components with high SEL immunity'],
        ['Displacement damage (DDD)', 'Crystal lattice defects in optical sensors and solar cells', 'Select DDD-qualified components; design margin'],
        ['Severe thermal cycling', 'Solder fatigue, cracks in encapsulation, interconnect failure', 'Thermal qualification by cycle; materials with compatible expansion; stress-relief design'],
        ['Vacuum', 'Degradation of polymers, sublimation, loss of lubricant properties', 'Low-outgassing materials; outgassing qualification'],
        ['Launch vibration and acoustics', 'Structural fatigue, fastener failure', 'Vibration test qualification; redundant module mounting'],
        ['Microgravity', 'No convection, localized overheating', 'Thermal design by conduction; dedicated heat sinks; per-component temperature monitoring'],
        ['Lunar or Martian dust', 'Connector and fan contamination, abrasion', 'IP sealing; no fans; abrasion-resistant surfaces']])}
      ${note('<b>Required qualification:</b> space-bound components need component-level qualification (QML class V or equivalent) plus system-level testing. No commercial component should be used in a critical function without derating, SEE and TID analysis specific to the mission.')}`;
    } },

    { n: 'Backup cascade', r() {
      const L = (n, t, a, b, c) => `<div class="px-lvl"><div class="px-n">${n}</div><div><h4>${t}</h4>${a}${b ? '<p><b>When it fails:</b> ' + b + '</p>' : ''}${c ? '<p><b>What the system does here:</b> ' + c + '</p>' : ''}</div></div>`;
      return H('Five-level backup cascade', 'WHAT HAPPENS WHEN A LAYER FAILS') + `
      <p class="px-lead">Each level is slower and less sophisticated than the one above it, but more robust. The system is never without an answer; it falls back to a progressively simpler one.</p>
      <div class="px-lvls">
      ${L(1, 'Flight surgeon · primary clinical authority', '<p>The only level with full clinical authority. Monitors, runs the Private Medical Conferences, authorizes medications and decides with the Flight Director on early return. Delivers complete clinical judgment, coordination of ground specialists and authority over irreversible decisions.</p>', 'latency beyond the tolerable threshold, link unavailability, planetary occlusion, solar conjunction or no return capability.', 'supports the decision. Does not replace it. Logs, organizes and packages the handoff.')}
      ${L(2, 'Advanced Space Life Supporter AI · graduated onboard autonomy', '<p>Takes over when level 1 is out of the real-time loop, with the hypothesis engine, the protocol engine and the verified pharmacy. Delivers three ranked hypotheses with probabilities, an explicit discriminator, a protocol compatible with the inventory, layered guided execution and a handoff queue.</p><p><b>Explicit limits:</b> it does not issue autonomous diagnoses, does not decide irreversible interventions on its own, and does not thrombolyse without neuroimaging.</p>', 'hardware failure, persistent SEFI, model corruption, energy exhaustion, or a sensor failure that makes inference impossible.')}
      ${L(3, 'Second AI instance · inference redundancy', '<p>A second inference instance, independent of the first, with a distinct model and execution path. The most important gap to close.</p>' + li(['<b>Diverse redundancy:</b> two models trained independently on separate hardware. If outputs diverge beyond a threshold, the system declares disagreement and lowers confidence instead of picking one.', '<b>Deterministic compact model:</b> a rules engine with no machine learning that reproduces the pre-authorized protocols in explicit, auditable logic. It is not a second clinical opinion; it guarantees the protocol stays executable without inference.']) + '<p>Recommendation: implement both. Diverse redundancy covers model error; the deterministic engine covers total inference failure.</p>')}
      ${L(4, 'Locally cached protocols', '<p>Pre-authorized clinical protocols stored on the spacecraft’s own hardware, versioned, integrity-checked and usable with no connection to Earth. Complete layer 1 and 2 protocols with doses, exclusion criteria, safety checks and early-return criteria: structured, executable text, not inference.</p><p>It depends on no model, no link and no significant power. A cached protocol is readable by a human with a working screen.</p><p><b>Requirements:</b> copies on two independent storage volumes, checksum at boot, versioning with ground-only updates, and integrity verification before any clinical use.</p>')}
      ${L(5, 'Printed physical documents and crash cart', '<p>The only level that depends on no power, no software and no screen. Laminated cards hold layer 1 emergency protocols, emergency drug doses, the CPR algorithm in microgravity, AED steps, early-return criteria and mission control contacts. The crash cart holds resuscitation and airway material (finite consumables). The Crew Medical Restraint System allows CPR in microgravity and needs three or four trained crew members.</p><p><b>Requirements:</b> vacuum- and thermal-tolerant printing, physical mounting in the medical module, content kept in sync with the digital protocol version, and periodic legibility checks by the crew.</p>', '', '')}
      </div>
      ${note('This level is neither sophisticated nor reversible, and that is exactly why it works. Same principle as the terrestrial crash cart, which keeps the first steps laminated on the lid.', 'ok')}
      ${sub('Cascade summary')}
      ${tbl(['Level', 'Layer', 'Depends on power', 'Depends on link', 'Depends on software', 'Clinical sophistication', 'Status'], [
        ['1', 'Flight surgeon', 'No (on the ground)', 'Yes', 'No', 'Highest', pill('Operational', 'ok')],
        ['2', 'Advanced Space Life Supporter AI', 'Yes', 'No', 'Yes', 'High', pill('Prototype', 'warn')],
        ['3', 'Second AI instance', 'Yes', 'No', 'Yes', 'Medium to high', pill('Not implemented · Phase 1 priority', 'crit')],
        ['4', 'Locally cached protocols', 'Yes, minimal', 'No', 'Yes, minimal', 'Medium', pill('Design requirement', 'warn')],
        ['5', 'Printed physical documents', 'No', 'No', 'No', 'Basic', pill('To be implemented', 'warn')]])}
      ${sub('Processing layers')}
      ${tbl(['Layer', 'Where it processes', 'What it processes', 'Link dependency'], [
        ['Acquisition', 'Onboard, at the sensor', 'Analog-to-digital conversion, basic filtering', 'None'],
        ['Quality validation', 'Onboard, dedicated low-power processor', 'Confidence score, artifact detection', 'None'],
        ['Normalization and baseline', 'Onboard', 'Comparison against the individual baseline', 'None'],
        ['Hypothesis engine', 'Onboard, main processor', 'Inference over parameters and findings', 'None'],
        ['Protocol engine', 'Onboard', 'Selection based on inventory and environment', 'None'],
        ['Pharmacy and verification', 'Onboard', 'Stock, lot, expiry, interaction', 'None'],
        ['Handoff', 'Onboard, with local queue', 'Packaging and compression', 'None to compose; link to transmit'],
        ['Validation and review', 'On the ground, with the flight surgeon', 'Post-event review, protocol adjustment', 'Requires link']])}
      ${sub('Local redundancy: copies, not the cloud')}
      ${tbl(['Asset', 'Primary storage', 'Backup', 'Integrity check'], [
        ['Individual baseline', 'Updated local copy', 'Weekly snapshot on a separate volume', 'Integrity comparison'],
        ['Drug inventory', 'Synchronized local registry', 'Periodic physical count by the crew', 'Divergence triggers an alert'],
        ['Decision log', 'Written to the primary volume', 'Mirrored to a secondary volume', 'Immutability by signature'],
        ['Handoff queue', 'Persistent local storage', 'Automatic resend on reconnection', 'Acknowledgment of receipt by the ground'],
        ['Inference model', 'Active version', 'Prior validated version kept offline', 'Hash checked at startup']])}`;
    } },

    { n: 'Priorities & excellence', r() {
      return H('Mission priorities and operational excellence', 'THE CONTRACT BETWEEN CARE AND SURVIVAL') + `
      <p class="px-lead">The mission priority matrix is the contract between clinical care and mission survival. The Advanced Space Life Supporter does not redefine it; it consults and respects it.</p>
      ${tbl(['Priority', 'Element', 'Conflict rule'], [['1', 'Crew integrity (life support)', 'Always prevails'], ['2', 'Habitability (thermal control, pressure, atmosphere)', 'Prevails over medical care, except in immediate life threat; the system declares the overlap explicitly'], ['3', 'Mission data and continuity of the science mission', 'Prevails over elective medical care'], ['4', 'Medical care (Advanced Space Life Supporter)', 'Fits within the energy budget declared by the mission']])}
      ${sub('Improvement cycle')}
      <p>Every clinical episode produces an auditable record. When the link returns, the flight surgeon reviews the episode and classifies the intervention as adequate, adequate with reservations or inadequate. That classification feeds protocol review on the ground. The system improves through versioned protocol updates, never through autonomous onboard learning.</p>
      ${note('<b>Why no autonomous learning:</b> unsupervised onboard learning is incompatible with a regulated environment. A model that changes behavior without ground validation is not auditable. Improvement comes from the review cycle, not from automatic adaptation.')}
      ${sub('Operational excellence metrics')}
      ${tbl(['Indicator', 'Target', 'How to measure'], [['Time to first hypothesis', 'Under 3 seconds in full mode; under 1 second in compact mode', 'Instrumented measurement'], ['Time to first correct intervention', 'Under 5 minutes in an emergency scenario', 'Timed simulation'], ['Poor-signal detection rate', 'Above 95%', 'Simulation with corrupted traces'], ['Correct abstention rate', 'Above 90% when data are insufficient', 'Simulation with missing data'], ['Handoff completeness', '100% of the ten fields filled', 'Automated verification']])}`;
    } },

    { n: 'Roadmap', r() {
      return H('Product roadmap', 'FROM HACKATHON PROTOTYPE TO FLIGHT') + `
      <div class="px-road">
        <div class="px-ph"><b>Phase 0 · Hackathon prototype</b><span>Now</span><p>Complete 13-screen wireframe, requirements v4.0, pitch script, flow demonstration.</p><em>Exit: presentation at Space Apps.</em></div>
        <div class="px-ph"><b>Phase 1 · Terrestrial analog validation</b><span>6 to 12 months</span><p>Confidence layer, individual baseline, additional-consultation trigger, layered protocols, second AI instance; tests with simulated delay and isolation.</p><em>Exit: hypothesis agreement with specialists above 80% in prioritized scenarios.</em></div>
        <div class="px-ph"><b>Phase 2 · Terrestrial operational pilot</b><span>12 to 24 months</span><p>Deployment in remote mining, an offshore platform or a link-less ambulance; real operation with medical supervision; hardened hardware specification finalized.</p><em>Exit: measurable reduction in time-to-intervention in a remote scenario.</em></div>
        <div class="px-ph"><b>Phase 3 · Space environment qualification</b><span>24 to 48 months</span><p>Software certification, hardware validation, integration with mission systems.</p><em>Exit: approval in a space agency qualification process.</em></div>
        <div class="px-ph"><b>Phase 4 · Flight operations</b><span>Beyond 48 months</span><p>Operational use in a crewed mission.</p><em>Exit: formal adoption.</em></div>
      </div>
      ${sub('Market route')}
      <p>The market sequence follows the increasing difficulty of validation, not visibility. First, terrestrial remote environments with medical supervision, where error is recoverable and evidence can be generated. Then remote environments without immediate supervision. Finally, the space environment, where validation is extremely expensive and error is irreversible.</p>`;
    } },

    { n: 'Risks & gaps', r() {
      return H('Risks, gaps and resolution plan', 'HONESTY IS PART OF THE ENGINEERING') + `
      ${sub('Risks and mitigations')}
      ${tbl(['Risk', 'Probability', 'Impact', 'Mitigation'], [
        ['Energy consumption compromises the mission', pill('Medium', 'warn'), pill('High', 'crit'), 'Risk matrix by energy level; explicit energy precedence; deterministic compact mode'],
        ['Inference model fails in microgravity', pill('Medium', 'warn'), pill('High', 'crit'), 'Individual baseline; safe abstention; validation in an analog before flight'],
        ['Pharmacokinetics altered in flight', pill('High', 'crit'), pill('High', 'crit'), 'Terrestrial doses with response monitoring; auditable log; conservative dosing'],
        ['Hardware degradation (SEE, TID)', pill('Medium', 'warn'), pill('High', 'crit'), 'Watchdog, error-correcting code, triple modular redundancy, redundant volumes'],
        ['Crew over-trust in the system', pill('Medium', 'warn'), pill('High', 'crit'), 'Explicit confidence score; safe abstention; training on system limits'],
        ['Loss of the handoff queue', pill('Low', 'ok'), pill('High', 'crit'), 'Persistent local storage, mirrored volumes, automatic resend on reconnection']])}
      ${sub('Acknowledged gaps')}
      ${tbl(['Gap', 'Why it is not resolved today', 'Resolution plan', 'Horizon'], [
        ['Second AI instance not implemented', 'Requires independent model training and separate hardware, out of hackathon scope', 'Implement diverse redundancy and a deterministic engine in Phase 1, with divergence testing in simulation', '6 to 12 months'],
        ['No automatic compression device validated in real spaceflight', 'Evidence limited to parabolic flight and manikins', 'Keep manual compression as the standard; automatic device as a conditional adjunct; track qualification', 'Ongoing'],
        ['No validated in-flight thrombolysis protocol', 'Without onboard neuroimaging, the decision is not to thrombolyse', 'Keep the explicit decision not to thrombolyse; document it as a safety limit, not a failure', 'Permanent decision'],
        ['Pharmacokinetics in microgravity poorly characterized', 'Limited literature on long-duration flight', 'Terrestrial doses with response monitoring and an auditable log; feed the database with every episode', 'Ongoing'],
        ['Bioimpedance validation in microgravity', 'Fluid redistribution alters impedance', 'Interpret as a trend against the baseline, never as an absolute value; correlate with TBone and Vascular', 'Ongoing'],
        ['Hardened hardware with limited inference performance', 'Physical trade-off among performance, power and tolerance', 'Heterogeneous architecture with an accelerated FPGA; accept slower inference and compensate with deterministic protocols', 'Phase 2'],
        ['No consolidated standard for medical autonomy to Mars', 'No public regulatory reference exists', 'Position as a copilot with graduated autonomy and pre-authorized protocols; join the normative discussion', 'Phase 3'],
        ['Printed physical documents not yet produced', 'Outside the digital prototype’s scope', 'Produce a physical emergency kit with layer 1 protocols, reviewed against the digital version', 'Phase 1']])}
      ${note('<b>Strategic synthesis:</b> the Advanced Space Life Supporter holds a defensible position. It addresses a structural gap that no communication technology closes, with an architecture that degrades honestly under energy constraint, backed by hardware viability grounded in flight-proven components. Its promise is deliberately modest and therefore credible: continuity of clinical care while the flight surgeon is unavailable, with every decision logged, auditable and reviewable.', 'ok')}`;
    } },

    { n: 'Sources', r() {
      const G = [
        ['Optical and space communications', ['NASA, Exploration and Space Communications: LCRD (nasa.gov/goddard/esc/lcrd)', 'NASA, Deep Space Optical Communications (DSOC) (nasa.gov and jpl.nasa.gov)', 'NASA JPL, Deep Space Communications Demo Exceeds Project Expectations, 2025', 'NASA, Laser Communications (nasa.gov/directorates/heo/scan/opticalcommunications)', 'NASA NTRS, LCRD Extended Experiment Program: Recent Results, 2025']],
        ['Radiation and semiconductor effects', ['ECSS-E-HB-20-40A, Engineering techniques for radiation effects mitigation in ASICs and FPGAs handbook, 2023', 'NASA JPL, Appendix Three: Space Radiation Effects on Integrated Circuits (parts.jpl.nasa.gov)', 'Enabling radiation tolerant heterogeneous GPU-based onboard data processing in space, CEAS Space Journal, 2020']],
        ['Space hardware and processors', ['NASA, Small Spacecraft Technology State of the Art Report: SmallSat Avionics, 2025', 'NASA, 8.0 Small Spacecraft Avionics (nasa.gov/smallsat-institute)', 'Comparative Benchmarking Analysis of Next-Generation Space Processors, NSF SHREC, 2019', 'Comparative Analysis of Present and Future Space-Grade Processors with Device Metrics, 2017', 'Microchip Technology, RTG4 Radiation-Tolerant FPGAs (microchip.com)', 'FPGA-Based Neural Network Accelerators for Space Applications: A Survey, arXiv 2504.16173', 'AMD, Radiation Effects in FPGAs and SoCs, EDHPC 2025', 'Maillard et al., Radiation Tolerant Deep Learning Processor Unit based platform using Xilinx 20nm Kintex UltraScale FPGA, IEEE Transactions on Nuclear Science, 2022']],
        ['Aerospace medicine and space agencies', ['NASA Human Research Program, 5 Hazards of Human Spaceflight (nasa.gov/hrp/hazards)', 'NASA Risks of Human Spaceflight (nasa.gov/hrp/risks)', 'NASA Exploration Medical Capability and Accepted Medical Condition List, NTRS 20220003136', 'NASA Appendix E, Health and Medical Care Technical Requirements', 'NASA Integrated Medical Model (IMM)', 'NASA Medical Operations Support Team, sub-optimal airway protocols for ISS, NTRS 20070031831', 'NASA Identification of Medical Training Methods for Exploration Missions, NTRS 20130013532', 'Canadian Space Agency, Vascular, TBone, Radi-N2, Microflow and Wayfinding experiments (asc-csa.gc.ca)', 'ESA, ALISSE project']],
        ['CPR and advanced life support in microgravity', ['DGLRM and ESAM-SMG, Cardiopulmonary resuscitation during spaceflight, Scandinavian Journal of Trauma, Resuscitation and Emergency Medicine, 2020', 'MACCC-0G, Manual versus automatic chest compression devices under zero gravity, Resuscitation, 2024', 'Determining the best technique: methods, challenges and innovations of performing microgravity CPR, Acta Astronautica, 2025', 'Mechanical cardiopulmonary resuscitation in microgravity and hypergravity conditions, American Journal of Emergency Medicine, 2024', 'Evaluation of free-floating tracheal intubation in weightlessness, npj Microgravity, 2023', 'Face-to-face videolaryngoscopy for tracheal intubation in microgravity, npj Microgravity, 2026', 'Challenges to Airway Management in Space, IntechOpen, 2021']],
        ['Terrestrial clinical guidelines', ['American Heart Association 2020 Guidelines for CPR and Emergency Cardiovascular Care, Part 3, Circulation', '2023 ESC Guidelines for the management of acute coronary syndromes, European Heart Journal', 'AHA/ASA 2019 Guidelines for the Early Management of Patients With Acute Ischemic Stroke, Stroke', 'Surviving Sepsis Campaign Guidelines 2021']]];
      return H('Sources and references', 'EVERY STATEMENT IS ANCHORED HERE') + G.map(g => card(g[0], li(g[1].map(e)))).join('') +
        note('Every technical and clinical statement in these documents is anchored in one of these sources. Technology demonstration results, ion beam testing, parabolic flight and simulation are presented as such, never as consolidated operational capability in a crewed mission.');
    } }
  ];

  let root, nav, view, cur = 0;
  function draw(keep) {
    nav.innerHTML = SECTIONS.map((s, i) => `<button class="px-nav ${i === cur ? 'on' : ''}" data-i="${i}" ${i === cur ? 'aria-current="page"' : ''}><i>${String(i + 1).padStart(2, '0')}</i><span>${s.n}</span></button>`).join('');
    view.innerHTML = '<div class="px-in">' + SECTIONS[cur].r() + `<div class="px-pager">${cur > 0 ? `<button class="btn" data-i="${cur - 1}">← ${e(SECTIONS[cur - 1].n)}</button>` : '<span></span>'}${cur < SECTIONS.length - 1 ? `<button class="btn cta" data-i="${cur + 1}">${e(SECTIONS[cur + 1].n)} →</button>` : '<span></span>'}</div><div class="px-logo2"><img src="stellar-beat-logo.webp" alt="Stellar Beat team logo" width="140" height="140" loading="lazy"><span>STELLAR BEAT TEAM · NASA SPACE APPS 2026</span></div></div>`;
    const b = nav.querySelector('.on'); if (b && b.scrollIntoView) { try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (x) { } }
    if (!keep) view.scrollTop = 0;
  }
  api.init = function (el) {
    if (api.ready || !el) return;
    root = el; root.innerHTML = '<aside class="px-side"><div class="px-logo">STRATEGY &amp; HARDWARE</div><div class="px-navlist" id="pxNav"></div></aside><div class="px-main" id="pxView" tabindex="-1"></div>';
    nav = root.querySelector('#pxNav'); view = root.querySelector('#pxView');
    root.addEventListener('click', ev => { const t = ev.target.closest('[data-i]'); if (!t) return; cur = +t.dataset.i; try { if (typeof sfx !== 'undefined') sfx.click(); } catch (x) { } draw(false); });
    api.ready = true; draw(false);
  };
  api.open = function () { if (api.ready) { cur = 0; draw(false); } };
})();
