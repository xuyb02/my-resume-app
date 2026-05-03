const API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL_CONFIG = "qwen-plus";

let conversationHistory = [];
let currentApiKey = "";
let currentMode = "resume"; // resume | diagnosis
let currentTemplate = "standard";

const dom = {
    apiKey: document.getElementById("apiKey"),
    input: document.getElementById("userInput"),
    send: document.getElementById("sendBtn"),
    clear: document.getElementById("clearBtn"),
    chat: document.getElementById("chatBox"),
    error: document.getElementById("errorMsg"),
    badge: document.getElementById("modelBadge"),
    meta: document.getElementById("responseMeta"),
    template: document.getElementById("templateSelect"),
    modeToggle: document.getElementById("modeToggle"),
    title: document.getElementById("appTitle"),
    guide: document.getElementById("appGuide"),
    exportBar: document.getElementById("exportBar"),
    exportPdf: document.getElementById("exportPdf"),
    exportWord: document.getElementById("exportWord"),
    exportBox: document.getElementById("exportContainer")
};

dom.apiKey.addEventListener("input", (e) => { currentApiKey = e.target.value.trim(); });
dom.send.addEventListener("click", handleSend);
dom.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } });
dom.clear.addEventListener("click", resetApp);
dom.modeToggle.addEventListener("click", toggleMode);
dom.template.addEventListener("change", (e) => { currentTemplate = e.target.value; updatePlaceholder(); });
dom.exportPdf.addEventListener("click", exportPDF);
dom.exportWord.addEventListener("click", exportWord);

function updatePlaceholder() {
    if (currentMode === "diagnosis") {
        dom.input.placeholder = "例如：我目前是大二学生，只会基础 Java，不知道能找什么实习岗位...";
    } else {
        const tips = { standard: "请输入经历与目标岗位...", tech: "侧重技术栈、项目深度、开源贡献...", product: "侧重数据分析、用户洞察、原型设计...", fresh: "侧重校园实践、课程设计、学习能力..." };
        dom.input.placeholder = tips[currentTemplate];
    }
}

function toggleMode() {
    currentMode = currentMode === "resume" ? "diagnosis" : "resume";
    dom.modeToggle.textContent = currentMode === "resume" ? "🔄 切换至职业诊断" : "🔄 切换至简历优化";
    dom.title.textContent = currentMode === "resume" ? "📝 简历优化与求职信生成器" : "🧭 智能职业诊断与建议";
    dom.guide.textContent = currentMode === "resume" 
        ? "输入个人经历或修改建议，AI 将基于上下文持续优化。" 
        : "技能较弱或迷茫期？AI 会询问你的阶段，提供阶梯学习路线与岗位匹配建议。";
    updatePlaceholder();
    resetApp();
}

async function handleSend() {
    const text = dom.input.value.trim();
    if (!text) return;
    if (!currentApiKey) { showError("⚠️ 请先粘贴阿里云百炼 API Key"); return; }

    dom.input.value = "";
    setLoading(true);
    showError("");
    appendMessage("user", text);
    conversationHistory.push({ role: "user", content: text });

    if (conversationHistory.length === 1) {
        const sysPrompt = currentMode === "resume"
            ? `你是一位资深 HR。请严格按【${getTemplateName()}】格式输出简历内容，使用 Markdown 排版。保持专业、数据化、突出亮点。`
            : "你是一位资深职业规划师。用户技能较弱或处于迷茫期时，请先温和询问其当前阶段（在校生/转行/初级等），了解后提供阶梯式学习路线、匹配岗位建议及避坑指南。保持鼓励与专业。";
        conversationHistory.unshift({ role: "system", content: sysPrompt });
    }

    const startTime = performance.now();
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentApiKey}` },
            body: JSON.stringify({ model: MODEL_CONFIG, messages: conversationHistory, temperature: 0.7, max_tokens: 2000 })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `请求失败 (HTTP ${res.status})`);
        }

        const data = await res.json();
        const aiContent = data.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: aiContent });
        appendMessage("assistant", aiContent);
        updateModelProof(data, performance.now() - startTime);
        
        if (currentMode === "resume") prepareExport(aiContent);
    } catch (err) { showError(`❌ ${err.message}`); } 
    finally { setLoading(false); dom.chat.scrollTop = dom.chat.scrollHeight; }
}

function getTemplateName() {
    return { standard: "标准通用", tech: "互联网技术岗", product: "产品/运营岗", fresh: "应届生/实习" }[currentTemplate];
}

function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = role === "user" ? content.replace(/\n/g, "<br>") : marked.parse(content);
    dom.chat.appendChild(div);
}

function updateModelProof(data, time) {
    const model = data.model || MODEL_CONFIG;
    const u = data.usage || {};
    dom.badge.innerHTML = `<span class="dot"></span> ✅ 已调用 ${model}`;
    dom.badge.classList.add("active");
    dom.meta.innerHTML = `
        <span class="meta-item">🤖 模型: <b>${model}</b></span>
        <span class="meta-item">⏱️ 耗时: ${(time/1000).toFixed(2)}s</span>
        <span class="meta-item">📊 Token: ${u.prompt_tokens||0}↑ / ${u.completion_tokens||0}↓</span>
    `;
    dom.meta.style.display = "flex";
}

function setLoading(isLoading) {
    dom.send.disabled = isLoading;
    dom.send.textContent = isLoading ? "⏳ 模型推理中..." : "✨ 生成 / 继续修改";
}
function showError(msg) { dom.error.textContent = msg; if(msg) setTimeout(()=>dom.error.textContent="", 6000); }

function resetApp() {
    conversationHistory = [];
    dom.chat.innerHTML = "";
    dom.meta.style.display = "none";
    dom.exportBar.style.display = "none";
    dom.exportBox.style.display = "none";
    dom.input.value = "";
    dom.badge.innerHTML = `<span class="dot"></span> 等待调用...`;
    dom.badge.classList.remove("active");
    updatePlaceholder();
}

// 📥 导出逻辑
function prepareExport(markdown) {
    dom.exportBox.innerHTML = `<div style="max-width: 680px; margin: 0 auto; color: #111;">${marked.parse(markdown)}</div>`;
    dom.exportBar.style.display = "flex";
}

async function exportPDF() {
    const btn = dom.exportPdf;
    btn.textContent = "⏳ 生成中..."; btn.disabled = true;
    try {
        await html2pdf().set({
            margin: 15, filename: '简历.pdf', image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(dom.exportBox).save();
    } finally { btn.textContent = "📥 导出 PDF"; btn.disabled = false; }
}

function exportWord() {
    const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>body{font-family:'SimSun',serif;line-height:1.6;color:#000;padding:20px;}h1,h2,h3{color:#111;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #333;padding:8px;}ul{margin-left:20px;}</style>
        </head><body>${dom.exportBox.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "简历.doc"; a.click();
    URL.revokeObjectURL(url);
}
