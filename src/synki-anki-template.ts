export const SYNKI_TEMPLATE_NAME = 'Cloze'

const CORE_TEMPLATE_FIELDS = new Set(['Text', 'Back Extra', 'One by one', 'Tags'])

const DEFAULT_SYNKI_TEMPLATE_FIELDS = [
	'Text',
	'Back Extra',
	'Definitionen',
	'Mechanismus',
	'Klinik',
	'Dosis',
	'Cave',
	'Merksprüche',
	'Eigene Prüfungsfragen',
	'Symptombild',
	'One by one',
]

export const SYNKI_FRONT_TEMPLATE = String.raw`<div id="obsidian-card" class="card-shell">
    <div id="text" class="main-text">
        {{cloze:Text}}
    </div>
</div>

<script>
(function () {
    function renderBoldMarkdown(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        nodes.forEach(function (node) {
            const text = node.nodeValue || "";
            if (!text.includes("**")) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const parts = text.split(/(\*\*[^*]+\*\*)/g);

            parts.forEach(function (part) {
                if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                    const strong = document.createElement("strong");
                    strong.textContent = part.slice(2, -2);
                    fragment.appendChild(strong);
                } else if (part.length > 0) {
                    fragment.appendChild(document.createTextNode(part));
                }
            });

            node.parentNode.replaceChild(fragment, node);
        });
    }

    const enabledValues = ["true", "on", "1", "ja"];
    const setting = ` + '`{{text:One by one}}`' + String.raw`.trim().toLowerCase();

    const textContainer = document.getElementById("text");
    if (textContainer) {
        renderBoldMarkdown(textContainer);
    }

    if (!enabledValues.includes(setting)) {
        return;
    }

    const clozes = document.querySelectorAll("#text .cloze");
    if (clozes.length < 2) {
        return;
    }

    const card = document.getElementById("obsidian-card");
    if (card) {
        card.style.visibility = "hidden";
    }

    function autoFlip() {
        if (window.pycmd) {
            pycmd("ans");
            return;
        }

        if (window.showAnswer) {
            showAnswer();
            return;
        }

        if (card) {
            card.style.visibility = "visible";
        }
    }

    setTimeout(autoFlip, 30);
})();
</script>`

export const SYNKI_BACK_TEMPLATE = buildSynkiBackTemplate()

export function buildSynkiBackTemplate(fields: string[] = DEFAULT_SYNKI_TEMPLATE_FIELDS): string {
	const extraFields = getExtraTemplateFields(fields)

	return String.raw`<div id="obsidian-card" class="card-shell" style="visibility:hidden;">
    <div id="text" class="main-text">
        {{cloze:Text}}
    </div>

    <div id="onebyone-controls" class="onebyone-controls" style="display:none;">
        <button id="next-point-button" class="reveal-button" onclick="revealNextCloze(); event.stopPropagation();">
            Next point <span class="shortcut">N</span>
        </button>
        <button class="reveal-button secondary" onclick="revealAllClozes(); event.stopPropagation();">
            Show all <span class="shortcut">,</span>
        </button>
        <button class="reveal-button secondary" onclick="resetClozes(); event.stopPropagation();">
            Reset <span class="shortcut">R</span>
        </button>
        <span id="onebyone-progress" class="onebyone-progress"></span>
    </div>

    <div id="after-answer">
        {{#Back Extra}}
        <div class="back-extra">
            {{Back Extra}}
        </div>
        {{/Back Extra}}

        <div class="extra-panels">
${renderExtraPanels(extraFields)}
        </div>

        <div class="field-buttons">
${renderExtraButtons(extraFields)}
        </div>

        {{#Tags}}
        <div class="tags">
            {{Tags}}
        </div>
        {{/Tags}}
    </div>
</div>

<script>
(function () {
    function renderBoldMarkdown(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        nodes.forEach(function (node) {
            const text = node.nodeValue || "";
            if (!text.includes("**")) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const parts = text.split(/(\*\*[^*]+\*\*)/g);

            parts.forEach(function (part) {
                if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                    const strong = document.createElement("strong");
                    strong.textContent = part.slice(2, -2);
                    fragment.appendChild(strong);
                } else if (part.length > 0) {
                    fragment.appendChild(document.createTextNode(part));
                }
            });

            node.parentNode.replaceChild(fragment, node);
        });
    }

    const enabledValues = ["true", "on", "1", "ja"];
    const oneByOneSetting = ` + '`{{text:One by one}}`' + String.raw`.trim().toLowerCase();

    const textContainer = document.getElementById("text");
    const card = document.getElementById("obsidian-card");
    const controls = document.getElementById("onebyone-controls");
    const nextPointButton = document.getElementById("next-point-button");
    const progress = document.getElementById("onebyone-progress");
    const afterAnswer = document.getElementById("after-answer");
    let oneByOneEnabled = false;
    let lastExtraShortcutAt = 0;
    let answers = [];
    let nextIndex = 0;

    if (!textContainer) {
        if (card) {
            card.style.visibility = "visible";
        }
        return;
    }

    renderBoldMarkdown(document.querySelector(".card-shell"));

    function updateProgress(clozeCount) {
        if (progress) {
            progress.textContent = nextIndex + " / " + clozeCount;
        }
    }

    function getPanels() {
        return Array.from(document.querySelectorAll(".field-button[data-panel]"))
            .map(function (button) {
                return document.getElementById(button.getAttribute("data-panel"));
            })
            .filter(function (panel) {
                return panel !== null;
            });
    }

    function getVisiblePanels() {
        return getPanels().filter(function (panel) {
            return panel.classList.contains("field-visible");
        });
    }

    function syncPanelButtons() {
        const buttons = Array.from(document.querySelectorAll(".field-button[data-panel]"));
        buttons.forEach(function (button) {
            const panel = document.getElementById(button.getAttribute("data-panel"));
            button.classList.toggle("field-button-active", Boolean(panel && panel.classList.contains("field-visible")));
            const oldShortcut = button.querySelector(".x-shortcut");
            if (oldShortcut) {
                oldShortcut.remove();
            }
        });

        const nextButton = buttons.find(function (button) {
            const panel = document.getElementById(button.getAttribute("data-panel"));
            return panel && !panel.classList.contains("field-visible");
        });
        if (nextButton) {
            const shortcut = document.createElement("span");
            shortcut.className = "shortcut x-shortcut";
            shortcut.textContent = "X";
            nextButton.appendChild(shortcut);
        }
    }

    window.toggleField = function (id) {
        const field = document.getElementById(id);
        if (!field) {
            return;
        }

        field.classList.toggle("field-visible");
        syncPanelButtons();
    };

    window.showNextExtraPanel = function () {
        const panels = getPanels();
        if (panels.length === 0) {
            return false;
        }

        const visiblePanels = getVisiblePanels();
        if (visiblePanels.length >= panels.length) {
            panels.forEach(function (panel) {
                panel.classList.remove("field-visible");
            });
            syncPanelButtons();
            return true;
        }

        panels[visiblePanels.length].classList.add("field-visible");
        syncPanelButtons();
        return true;
    };

    function initOneByOne() {
        const clozes = Array.from(textContainer.querySelectorAll(".cloze"));
        const enabled = clozes.length >= 2 && enabledValues.includes(oneByOneSetting);

        if (!enabled) {
            return;
        }

        oneByOneEnabled = true;

        answers = clozes.map(function (cloze) {
            return cloze.innerHTML;
        });

        clozes.forEach(function (cloze) {
            cloze.innerHTML = "[...]";
            cloze.classList.add("cloze-pending");
        });

        if (controls) {
            controls.style.display = "flex";
        }

        if (afterAnswer) {
            afterAnswer.style.display = "none";
        }
        updateProgress(clozes.length);

        window.revealNextCloze = function () {
            if (nextIndex >= clozes.length) {
                return;
            }

            clozes[nextIndex].innerHTML = answers[nextIndex];
            clozes[nextIndex].classList.remove("cloze-pending");
            nextIndex += 1;
            updateProgress(clozes.length);

            if (nextIndex >= clozes.length) {
                if (nextPointButton) {
                    nextPointButton.disabled = true;
                }

                if (afterAnswer) {
                    afterAnswer.style.display = "block";
                }
            }
        };

        window.revealAllClozes = function () {
            clozes.forEach(function (cloze, index) {
                cloze.innerHTML = answers[index];
                cloze.classList.remove("cloze-pending");
            });

            nextIndex = clozes.length;
            updateProgress(clozes.length);

            if (nextPointButton) {
                nextPointButton.disabled = true;
            }

            if (afterAnswer) {
                afterAnswer.style.display = "block";
            }
        };

        window.resetClozes = function () {
            clozes.forEach(function (cloze) {
                cloze.innerHTML = "[…]";
                cloze.classList.add("cloze-pending");
            });
            nextIndex = 0;
            if (nextPointButton) {
                nextPointButton.disabled = false;
            }
            if (afterAnswer) {
                afterAnswer.style.display = "none";
            }
            getPanels().forEach(function (panel) {
                panel.classList.remove("field-visible");
            });
            syncPanelButtons();
            updateProgress(clozes.length);
        };
    }

    if (typeof window.revealNextCloze !== "function") {
        window.revealNextCloze = function () {};
    }

    if (typeof window.revealAllClozes !== "function") {
        window.revealAllClozes = function () {};
    }

    if (typeof window.resetClozes !== "function") {
        window.resetClozes = function () {};
    }

    initOneByOne();

    document.querySelectorAll(".symptom-field img").forEach(function (image) {
        image.addEventListener("click", function () {
            image.classList.toggle("image-zoomed");
        });
    });

    if (card) {
        card.style.visibility = "visible";
    }

    function handleReviewShortcut(event) {
        const key = event.key.toLowerCase();
        const hasPlainModifier = !event.ctrlKey && !event.altKey && !event.metaKey;
        const isExtraShortcut = hasPlainModifier && (key === "x" || event.code === "KeyX");

        if (isExtraShortcut) {
            const now = Date.now();
            if (now - lastExtraShortcutAt < 120) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            if (window.showNextExtraPanel()) {
                lastExtraShortcutAt = now;
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }

        if (key === "n" && hasPlainModifier && oneByOneEnabled) {
            event.preventDefault();
            event.stopPropagation();
            window.revealNextCloze();
            return;
        }

        if (key === "," && hasPlainModifier && oneByOneEnabled) {
            event.preventDefault();
            event.stopPropagation();
            window.revealAllClozes();
            return;
        }

        if (key === "r" && hasPlainModifier && oneByOneEnabled) {
            event.preventDefault();
            event.stopPropagation();
            window.resetClozes();
        }
    }

    document.addEventListener("keydown", handleReviewShortcut, true);
})();
</script>`
}

function getExtraTemplateFields(fields: string[]): string[] {
	const seen = new Set<string>()
	const extraFields: string[] = []

	for (const field of fields.map((value) => value.trim()).filter(Boolean)) {
		if (CORE_TEMPLATE_FIELDS.has(field) || seen.has(field) || field.includes('{') || field.includes('}')) {
			continue
		}

		seen.add(field)
		extraFields.push(field)
	}

	return extraFields
}

function renderExtraPanels(fields: string[]): string {
	return fields
		.map((field, index) => {
			const panelId = `field-extra-${String(index + 1)}`
			const escapedField = escapeHTML(field)
			const styleClass = getFieldStyleClass(field)
			return String.raw`            {{#${field}}}
            <div id="${panelId}" class="extra-field ${styleClass}-field">
                <div class="field-title">${escapedField}</div>
                <div class="field-content">{{${field}}}</div>
            </div>
            {{/${field}}}`
		})
		.join('\n\n')
}

function renderExtraButtons(fields: string[]): string {
	return fields
		.map((field, index) => {
			const panelId = `field-extra-${String(index + 1)}`
			const escapedField = escapeHTML(field)
			const styleClass = getFieldStyleClass(field)
			return String.raw`            {{#${field}}}
            <button class="field-button ${styleClass}-button" data-panel="${panelId}" onclick="toggleField('${panelId}'); event.stopPropagation();">${escapedField}</button>
            {{/${field}}}`
		})
		.join('\n\n')
}

function getFieldStyleClass(field: string): string {
	const normalized = field.toLowerCase()
	if (normalized.includes('prüfung')) return 'question'
	if (normalized.includes('definition')) return 'definition'
	if (normalized.includes('mechanismus')) return 'mechanism'
	if (normalized.includes('klinik')) return 'clinic'
	if (normalized.includes('dosis')) return 'dose'
	if (normalized.includes('cave')) return 'cave'
	if (normalized.includes('merk')) return 'mnemonic'
	if (normalized.includes('symptom')) return 'symptom'
	return 'definition'
}

function escapeHTML(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

export const SYNKI_STYLING = String.raw`:root {
    --bg: #2f2f31;
    --text: #ececef;
    --bg-dark: #2f2f31;
    --text-dark: #ececef;
    --cloze: #68c58b;
    --cloze-dark: #68c58b;
    --pending: #ee7d88;
    --bold: #68c58b;
    --extra-bg: rgba(120, 120, 120, 0.08);
    --border: rgba(120, 120, 120, 0.25);
    --question: #efad67;
    --definition: #a3b2c2;
    --mechanism: #bb9aea;
    --clinic: #68c58b;
    --dose: #efad67;
    --cave: #ee7d88;
    --mnemonic: #7eb9f3;
    --symptom: #e99bb5;
    --button-bg: rgba(120, 120, 120, 0.08);
    --button-hover: rgba(120, 120, 120, 0.18);
    --max-width: 1080px;
}

.card {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif !important;
    font-size: 21px;
    line-height: 1.38;
    color: var(--text);
    background: var(--bg);
    text-align: left;
    margin: 0;
    padding: 0;
}

.nightMode.card,
.night_mode .card {
    color: var(--text-dark);
    background: var(--bg-dark);
}

.card-shell {
    width: 100%;
    max-width: var(--max-width);
    margin: 0 auto;
    box-sizing: border-box;
    padding: 32px 40px 82px;
}

.main-text,
.main-text *,
.back-extra,
.back-extra *,
.extra-field,
.extra-field *,
.field-content,
.field-content *,
.field-title,
.field-button,
.reveal-button,
.tags {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif !important;
}

.main-text {
    width: 100%;
    font-size: clamp(21px, 2.1vw, 30px);
    font-weight: 500;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    box-sizing: border-box;
}

b,
strong {
    color: var(--bold);
}

#obsidian-card u {
    color: #50c8c9;
    text-decoration-color: #50c8c9;
    text-underline-offset: 0.12em;
}

#obsidian-card em {
    color: #bb9aea;
}

a {
    color: #7eb9f3;
}

.cloze {
    color: var(--cloze) !important;
    font-weight: 700;
}

.nightMode .cloze,
.night_mode .cloze {
    color: var(--cloze-dark) !important;
}

.cloze-pending {
    color: var(--pending) !important;
    font-weight: 700;
}

.back-extra {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 24px;
    padding: 15px 17px;
    border-left: 4px solid #909090;
    border-radius: 6px;
    background: var(--extra-bg);
    font-size: 18px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.onebyone-controls {
    width: 100%;
    box-sizing: border-box;
    margin-top: 22px;
    gap: 9px;
    flex-wrap: wrap;
}

.shortcut {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    opacity: 0.65;
}

.reveal-button,
.field-button {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 7px 11px;
    font-size: 13px;
    line-height: 1.2;
    cursor: pointer;
    color: inherit;
    background: var(--button-bg);
    box-shadow: none;
}

.reveal-button:hover,
.field-button:hover {
    background: var(--button-hover);
}

.field-button-active {
    background: var(--button-hover);
}

.secondary {
    opacity: 0.7;
}

.extra-panels {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 16px;
}

.extra-field {
    display: none;
    width: 100%;
    box-sizing: border-box;
    margin-top: 12px;
    padding: 14px 16px;
    border-radius: 6px;
    background: var(--extra-bg);
    font-size: 18px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.extra-field.field-visible {
    display: block;
}

.field-title {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.65;
}

.field-content {
    width: 100%;
    box-sizing: border-box;
    overflow-wrap: anywhere;
}

.question-field { border-left: 4px solid var(--question); }
.definition-field { border-left: 4px solid var(--definition); }
.mechanism-field { border-left: 4px solid var(--mechanism); }
.clinic-field { border-left: 4px solid var(--clinic); }
.dose-field { border-left: 4px solid var(--dose); }
.cave-field { border-left: 4px solid var(--cave); }
.mnemonic-field { border-left: 4px solid var(--mnemonic); }
.symptom-field { border-left: 4px solid var(--symptom); }
.question-field, .dose-field { background: #3b3128; }
.definition-field { background: #2d3540; }
.mechanism-field { background: #332d3d; }
.clinic-field { background: #283a32; }
.cave-field { background: #3d2b30; }
.mnemonic-field { background: #2b3442; }
.symptom-field { background: #3b2d36; }

.field-buttons {
    display: flex;
    width: 100%;
    box-sizing: border-box;
    margin-top: 18px;
    gap: 7px;
    flex-wrap: wrap;
}

.question-button { border-color: var(--question); }
.definition-button { border-color: var(--definition); }
.mechanism-button { border-color: var(--mechanism); }
.clinic-button { border-color: var(--clinic); }
.dose-button { border-color: var(--dose); }
.cave-button { border-color: var(--cave); }
.mnemonic-button { border-color: var(--mnemonic); }
.symptom-button { border-color: var(--symptom); }
.question-button, .dose-button { color: #ffd1a1; }
.definition-button { color: #cad7e5; }
.mechanism-button { color: #decafa; }
.clinic-button { color: #b9ecc9; }
.cave-button { color: #ffc3c8; }
.mnemonic-button { color: #c4ddff; }
.symptom-button { color: #ffc7d9; }
.question-button.field-button-active, .dose-button.field-button-active { background: #70502e; }
.definition-button.field-button-active { background: #46586b; }
.mechanism-button.field-button-active { background: #5a4671; }
.clinic-button.field-button-active { background: #35684f; }
.cave-button.field-button-active { background: #743f48; }
.mnemonic-button.field-button-active { background: #405e83; }
.symptom-button.field-button-active { background: #754459; }

.tags {
    display: none !important;
}

ul,
ol {
    margin-top: 7px;
    margin-bottom: 7px;
    padding-left: 1.5em;
}

li {
    margin-top: 2px;
    margin-bottom: 2px;
}

table {
    width: 100%;
    border-collapse: collapse;
    box-sizing: border-box;
}

td,
th {
    border: 1px solid var(--border);
    padding: 6px;
}

img {
    max-width: 100%;
    height: auto;
}

.symptom-field img {
    cursor: zoom-in;
    max-height: 52vh;
    object-fit: contain;
}

.symptom-field img.image-zoomed {
    cursor: zoom-out;
    max-height: none;
}

@media (max-width: 600px) {
    .card {
        font-size: 18px;
        padding: 0;
    }

    .card-shell { padding: 24px 18px 135px; }

    .onebyone-controls {
        position: sticky;
        bottom: 0;
        z-index: 5;
        margin: 22px -20px 0;
        padding: 12px 20px;
        background: #2f2f31f2;
    }

    .back-extra,
    .extra-field {
        font-size: 17px;
    }

    .field-button,
    .reveal-button {
        font-size: 12px;
    }
}`
