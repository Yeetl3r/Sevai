const pptxgen = require("pptxgenjs");
const path = require("path");

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Sevai-Scout Pitch Deck';
pres.author = 'Abishek / Team Sevai';

// Colors (No '#' as per pptxgenjs guide)
const COLORS = {
    PRIMARY: "2C5F2D", // Forest Green
    SECONDARY: "97BC62", // Moss Green
    ACCENT: "F5F5F5", // Off-white/Cream
    TEXT_DARK: "1F2937", // Gray-800
    TEXT_LIGHT: "FFFFFF"
};

const HERO_IMAGE_PATH = path.resolve("/Users/abishek/.gemini/antigravity/brain/d36f5dca-c7b7-4ca6-968e-437d15811208/sevai_scout_hero_1776312848787.png");

// Helper for Slide Headers
function addHeader(slide, title) {
    slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: '100%', h: 1.0, fill: { color: COLORS.PRIMARY }
    });
    slide.addText(title, {
        x: 0.5, y: 0.2, w: 9, h: 0.6,
        fontSize: 32, bold: true, color: COLORS.TEXT_LIGHT, valign: 'middle'
    });
}

// 1. TITLE SLIDE
let slide1 = pres.addSlide();
slide1.background = { color: COLORS.ACCENT };
slide1.addImage({
    path: HERO_IMAGE_PATH,
    x: 0, y: 0, w: '100%', h: '100%',
    sizing: { type: 'cover', w: 10, h: 5.625 }
});
// Overlay for text visibility
slide1.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 3.5, w: 6.5, h: 1.5,
    fill: { color: COLORS.PRIMARY, transparency: 10 }
});
slide1.addText("Sevai-Scout", {
    x: 0.7, y: 3.6, w: 6, h: 0.8,
    fontSize: 44, bold: true, color: COLORS.TEXT_LIGHT
});
slide1.addText("Bridging the ₹ Trillion Schemes Gap in Rural India", {
    x: 0.7, y: 4.4, w: 6, h: 0.4,
    fontSize: 18, color: COLORS.SECONDARY, italic: true
});

// 2. THE PROBLEM
let slide2 = pres.addSlide();
addHeader(slide2, "The Silent Crisis");
slide2.addText([
    { text: "Awareness Gap", options: { bold: true, breakLine: true } },
    { text: "70% of citizens aren't aware of schemes they qualify for.", options: { bullet: true, breakLine: true } },
    { text: "Complex Jargon: Application forms are in technical, non-standard language.", options: { bullet: true, breakLine: true } },
    { text: "Digital Divide: portals require high-speed internet & smartphones.", options: { bullet: true, breakLine: true } },
    { text: "Literacy Barriers: Text-heavy processes exclude the most vulnerable.", options: { bullet: true } }
], { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 18, color: COLORS.TEXT_DARK });

// 3. THE SOLUTION
let slide3 = pres.addSlide();
addHeader(slide3, "Sevai-Scout: The Rural-First Platform");
slide3.addText("A multi-channel AI platform simplifying discovery and discovery for the last-mile citizen.", {
    x: 0.5, y: 1.2, w: 9, h: 0.5, fontSize: 16, italic: true
});
slide3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 2, w: 2.8, h: 2.5, fill: { color: "FFFFFF" }, line: { color: COLORS.SECONDARY, width: 1 } });
slide3.addText("WhatsApp/SMS\nAccess", { x: 0.5, y: 2.2, w: 2.8, h: 1, align: 'center', bold: true, color: COLORS.PRIMARY });
slide3.addShape(pres.shapes.RECTANGLE, { x: 3.6, y: 2, w: 2.8, h: 2.5, fill: { color: "FFFFFF" }, line: { color: COLORS.SECONDARY, width: 1 } });
slide3.addText("AI Sahayak Mode\n(Tamil/English)", { x: 3.6, y: 2.2, w: 2.8, h: 1, align: 'center', bold: true, color: COLORS.PRIMARY });
slide3.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 2, w: 2.8, h: 2.5, fill: { color: "FFFFFF" }, line: { color: COLORS.SECONDARY, width: 1 } });
slide3.addText("Voice-First\nDesign", { x: 6.7, y: 2.2, w: 2.8, h: 1, align: 'center', bold: true, color: COLORS.PRIMARY });

// 4. INNOVATION 1: AI INTENT
let slide4 = pres.addSlide();
addHeader(slide4, "Claude AI: Conversational Eligibility");
slide4.addText([
    { text: "Natural Language Processing (Tamil & English)", options: { bullet: true, breakLine: true } },
    { text: "No Forms Required: Intents are extracted from casual chat.", options: { bullet: true, breakLine: true } },
    { text: "Real-time Matching: Scans our optimized schemes database instantly.", options: { bullet: true, breakLine: true } },
    { text: "Privacy-Preserving: User data is parsed locally for minimal exposure.", options: { bullet: true } }
], { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 18 });

// 5. INNOVATION 2: ACCESSIBILITY
let slide5 = pres.addSlide();
addHeader(slide5, "Radical Reach: Edge Accessibility");
slide5.addText([
    { text: "Zero-Data Mode: Works via standard SMS for feature phones.", options: { bullet: true, breakLine: true } },
    { text: "Familiarity: WhatsApp integration as the primary touchpoint.", options: { bullet: true, breakLine: true } },
    { text: "Voice Fallback: Schemes are 'spoken' back to the user.", options: { bullet: true, breakLine: true } },
    { text: "Offline-Ready: Optimized local caching for low-signal rural pockets.", options: { bullet: true } }
], { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 18 });

// 6. ARCHITECTURE
let slide6 = pres.addSlide();
addHeader(slide6, "Resilient Tech Stack");
slide6.addTable([
    ["Layer", "Technology", "Role"],
    ["Frontend", "Next.js / Vanilla CSS", "Aesthetic, responsive UI"],
    ["Logic", "Node.js / Express", "Bot-flow & Intent Processing"],
    ["Database", "SQLite (Edge)", "Lightweight scheme persistence"],
    ["Messaging", "Twilio API", "WhatsApp & SMS Gateway"],
    ["Intelligence", "Claude 3.5 Sonnet", "Contextual engine"]
], { x: 0.5, y: 1.5, w: 9, border: { color: "CCCCCC", width: 1 }, fill: { color: "F9FAFB" }, fontSize: 16 });

// 7. FUTURE ROADMAP
let slide7 = pres.addSlide();
addHeader(slide7, "Scaling the Impact");
slide7.addText([
    { text: "Phase 1: Direct Aadhaar-Link Eligibility", options: { bullet: true, breakLine: true } },
    { text: "Phase 2: Multilingual Support (10+ Regional Languages)", options: { bullet: true, breakLine: true } },
    { text: "Phase 3: Community Ambassador Dashboard (Service tracking)", options: { bullet: true, breakLine: true } },
    { text: "Phase 4: Automated Application Submission API", options: { bullet: true } }
], { x: 0.5, y: 1.5, w: 9, h: 3, fontSize: 20 });

// 8. FINAL SLIDE
let slide8 = pres.addSlide();
slide8.background = { color: COLORS.PRIMARY };
slide8.addText("Join the Movement", {
    x: 0, y: 2, w: 10, h: 1, align: 'center', fontSize: 44, bold: true, color: COLORS.TEXT_LIGHT
});
slide8.addText("Turning 'Government Schemes' into Real Impact", {
    x: 0, y: 3, w: 10, h: 0.5, align: 'center', fontSize: 20, color: COLORS.SECONDARY
});

const outputName = "Sevai-Scout-Pitch.pptx";
pres.writeFile({ fileName: outputName }).then(fileName => {
    console.log(`Presentation generated: ${fileName}`);
}).catch(err => {
    console.error(`Error: ${err}`);
    process.exit(1);
});
