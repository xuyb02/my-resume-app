const apiKeyInput = document.getElementById("apiKey");
const userInput = document.getElementById("userInput");
const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");
const replyArea = document.getElementById("replyArea");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");

const API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const conversationHistory = [];

function setLoading(isLoading) {
  loadingEl.classList.toggle("hidden", !isLoading);
  generateBtn.disabled = isLoading;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderConversation() {
  if (conversationHistory.length === 0) {
    replyArea.innerHTML = '<p class="placeholder">模型回复会显示在这里。</p>';
    return;
  }

  replyArea.innerHTML = conversationHistory
    .map((item) => {
      const roleLabel = item.role === "user" ? "用户" : "助手";
      const contentHtml =
        item.role === "assistant"
          ? marked.parse(item.content || "")
          : `<p>${escapeHtml(item.content || "")}</p>`;

      return `
        <article class="chat-item">
          <p class="chat-role">${roleLabel}</p>
          <div class="chat-content">${contentHtml}</div>
        </article>
      `;
    })
    .join("");
}

async function generateReply() {
  clearError();

  const apiKey = apiKeyInput.value.trim();
  const message = userInput.value.trim();

  if (!apiKey) {
    showError("请先输入 API Key。");
    return;
  }
  if (!message) {
    showError("请输入用户问题后再生成回复。");
    return;
  }

  conversationHistory.push({ role: "user", content: message });
  renderConversation();
  userInput.value = "";
  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: conversationHistory,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const apiMessage = data && data.error && data.error.message
        ? data.error.message
        : "请求失败，请检查 API Key 或网络。";
      throw new Error(apiMessage);
    }

    const assistantReply = data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
      ? data.choices[0].message.content
      : "";

    if (!assistantReply) {
      throw new Error("模型未返回有效内容。");
    }

    conversationHistory.push({ role: "assistant", content: assistantReply });
    renderConversation();
  } catch (error) {
    conversationHistory.pop();
    renderConversation();
    showError(`生成失败：${error.message}`);
  } finally {
    setLoading(false);
  }
}

function clearConversation() {
  conversationHistory.length = 0;
  userInput.value = "";
  clearError();
  setLoading(false);
  renderConversation();
}

generateBtn.addEventListener("click", generateReply);
clearBtn.addEventListener("click", clearConversation);

userInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    generateReply();
  }
});

renderConversation();
