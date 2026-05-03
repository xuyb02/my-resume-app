const API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL_CONFIG = "qwen-plus"; // 阿里云标准模型名，作业文档笔误已修正

let conversationHistory = [];
let currentApiKey = "";

const apiKeyInput = document.getElementById("apiKey");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const chatBox = document.getElementById("chatBox");
const errorMsg = document.getElementById("errorMsg");
const modelBadge = document.getElementById("modelBadge");
const responseMeta = document.getElementById("responseMeta");

apiKeyInput.addEventListener("input", (e) => { currentApiKey = e.target.value.trim(); });

sendBtn.addEventListener("click", handleSend);
userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

clearBtn.addEventListener("click", () => {
    conversationHistory = [];
    chatBox.innerHTML = `<div class="message assistant system-hint">💡 提示：首次对话请提供背景信息；生成后可直接输入“更简短”“换风格”“侧重某技能”继续修改。</div>`;
    errorMsg.textContent = "";
    responseMeta.style.display = "none";
    userInput.value = "";
    modelBadge.innerHTML = `<span class="dot"></span> 等待调用...`;
    modelBadge.classList.remove("active");
});

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;
    if (!currentApiKey) { showError("⚠️ 请先粘贴阿里云百炼 API Key"); return; }

    userInput.value = "";
    setLoading(true);
    showError("");
    appendMessage("user", text);
    conversationHistory.push({ role: "user", content: text });

    if (conversationHistory.length === 1) {
        conversationHistory.unshift({
            role: "system",
            content: "你是一位资深 HR 与简历优化专家。请根据用户的经历、目标岗位生成结构清晰、数据化、突出亮点的简历内容或求职信。若用户后续提出修改建议，请严格按要求调整，保持多轮对话连贯。"
        });
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
    } catch (err) {
        showError(`❌ ${err.message}`);
    } finally {
        setLoading(false);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = role === "user" ? content.replace(/\n/g, "<br>") : marked.parse(content);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function updateModelProof(data, timeTaken) {
    const model = data.model || MODEL_CONFIG;
    const usage = data.usage || {};
    const tokens = `${usage.prompt_tokens || 0}↑ / ${usage.completion_tokens || 0}↓ / 总计 ${usage.total_tokens || 0}`;
    
    modelBadge.innerHTML = `<span class="dot"></span> ✅ 已调用 ${model}`;
    modelBadge.classList.add("active");
    
    responseMeta.innerHTML = `
        <span class="meta-item">🤖 模型: <b>${model}</b></span>
        <span class="meta-item">⏱️ 耗时: ${(timeTaken/1000).toFixed(2)}s</span>
        <span class="meta-item">📊 Token: ${tokens}</span>
    `;
    responseMeta.style.display = "flex";
}

function setLoading(isLoading) {
    sendBtn.disabled = isLoading;
    sendBtn.textContent = isLoading ? "⏳ 模型推理中..." : "✨ 生成 / 继续修改";
}

function showError(msg) { errorMsg.textContent = msg; if(msg) setTimeout(()=>errorMsg.textContent="", 6000); }
