/**
 * popup.js
 * Main logic for the SEO Quick Auditor extension.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  let auditData = null;
  let pageSpeedData = null;

  // --- Tab Logic ---
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // --- Initialization ---
  const init = async () => {
    const isExtension = typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query;
    
    if (isExtension) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.url || tab.url.startsWith("chrome://")) {
          showError("Cannot audit internal chrome pages.");
          return;
        }

        document.getElementById("scanned-url").textContent = tab.url;

        // 1. Run Content Script Audit
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        auditData = results[0].result;
        
        // 2. Run PageSpeed Audit (Non-blocking)
        runPageSpeedAudit(tab.url);

        processAudit(auditData);
      } catch (err) {
        console.error(err);
        showError("Failed to access page. Try refreshing.");
      }
    } else {
      // Mock data for preview in AI Studio
      mockAudit();
    }
  };

  const processAudit = (data) => {
    let score = 0;
    const wins = [];
    const details = [];

    // --- Scoring Logic ---
    // Title (+15)
    const titleOk = data.titleLength >= 30 && data.titleLength <= 60;
    if (titleOk) score += 15;
    else wins.push("Optimize page title (30-60 chars)");
    details.push({
      title: "Page Title",
      value: `${data.title} (${data.titleLength} chars)`,
      status: titleOk ? "green" : "yellow",
      tip: "Keep titles between 30 and 60 characters for best Google display."
    });

    // Meta (+15)
    const metaOk = data.metaDescriptionLength > 0 && data.metaDescriptionLength <= 160;
    if (metaOk) score += 15;
    else wins.push("Add/Improve Meta Description");
    details.push({
      title: "Meta Description",
      value: data.metaDescription ? `${data.metaDescription.substring(0, 50)}... (${data.metaDescriptionLength} chars)` : "Missing",
      status: metaOk ? "green" : "red",
      tip: "Include a compelling summary under 160 characters to increase CTR."
    });

    // H1 (+10)
    const h1Ok = data.h1s.length === 1;
    if (h1Ok) score += 10;
    else wins.push(data.h1s.length === 0 ? "Add an H1 tag" : "Only use ONE H1 tag");
    details.push({
      title: "H1 Tags",
      value: `${data.h1s.length} found: ${data.h1s.join(", ")}`,
      status: h1Ok ? "green" : "red",
      tip: "Each page should have exactly one H1 tag with your main keyword."
    });

    // Image Alts (+15)
    const altsOk = data.missingAltImages.length === 0;
    if (altsOk) score += 15;
    else wins.push(`Fix ${data.missingAltImages.length} images missing alt text`);
    details.push({
      title: "Image Alt Text",
      value: altsOk ? "All clear" : `${data.missingAltImages.length} missing alt attributes`,
      status: altsOk ? "green" : "yellow",
      tip: "Alt text helps search engines understand images and improves accessibility."
    });

    // Canonical (+10)
    const canonicalOk = !!data.canonicalUrl;
    if (canonicalOk) score += 10;
    else wins.push("Add a canonical link");
    details.push({
      title: "Canonical URL",
      value: data.canonicalUrl || "Missing",
      status: canonicalOk ? "green" : "yellow",
      tip: "Canonical tags prevent duplicate content issues by signaling the preferred version."
    });

    // Word Count (+15)
    const wordsOk = data.wordCount > 300;
    if (wordsOk) score += 15;
    else wins.push("Increase content to 300+ words");
    details.push({
      title: "Word Count",
      value: `${data.wordCount} words`,
      status: wordsOk ? "green" : "yellow",
      tip: "Pages with more relevant content generally rank higher in search results."
    });

    // PageSpeed is added later (+20)
    renderAudit(score, wins, details);
  };

  const renderAudit = (baseScore, wins, details) => {
    // Update Score UI
    const finalScore = baseScore;
    updateCircularScore(finalScore);

    // Update Rating Badge
    const ratingText = document.getElementById("rating-text");
    if (finalScore >= 80) {
      ratingText.textContent = "Healthy Rating";
      ratingText.style.background = "#DCFCE7";
      ratingText.style.color = "#166534";
    } else if (finalScore >= 50) {
      ratingText.textContent = "Average Rating";
      ratingText.style.background = "#FEF3C7";
      ratingText.style.color = "#92400E";
    } else {
      ratingText.textContent = "Critical Rating";
      ratingText.style.background = "#FEE2E2";
      ratingText.style.color = "#991B1B";
    }

    // Render Wins
    const winsList = document.getElementById("quick-wins-list");
    winsList.innerHTML = wins.length ? "" : "<li>🎉 No major quick wins found! You're in good shape.</li>";
    wins.forEach(win => {
      const li = document.createElement("li");
      li.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${win}`;
      winsList.appendChild(li);
    });

    // Update Pass Count
    const passes = details.filter(d => d.status === 'green').length;
    document.getElementById("passes-count").textContent = `${passes}/${details.length} Passes`;

    // Render Details
    const accordion = document.getElementById("details-accordion");
    accordion.innerHTML = "";
    details.forEach(item => {
      const el = document.createElement("div");
      el.className = "accordion-item";
      const icon = item.status === 'green' ? '✓' : (item.status === 'yellow' ? '!' : '✕');
      el.innerHTML = `
        <div class="accordion-header">
          <div class="accordion-title">
            <div class="status-icon ${item.status}">${icon}</div>
            ${item.title}
          </div>
          <span style="color: var(--text-light); font-size: 10px;">▼</span>
        </div>
        <div class="accordion-content" style="display:none">
          <div class="detail-value">${item.value}</div>
          <div class="fix-tip"><strong>💡 Tip:</strong> ${item.tip}</div>
        </div>
      `;
      
      el.querySelector(".accordion-header").addEventListener("click", () => {
        const content = el.querySelector(".accordion-content");
        content.style.display = content.style.display === "none" ? "block" : "none";
      });

      accordion.appendChild(el);
    });

    // Update Preview
    document.getElementById("export-preview").textContent = JSON.stringify({ audit: auditData, metrics: pageSpeedData }, null, 2);
  };

  const updateCircularScore = (score) => {
    const scoreEl = document.getElementById("overall-score");
    const scorePath = document.getElementById("score-path");
    
    scoreEl.textContent = score;
    scorePath.setAttribute("stroke-dasharray", `${score}, 100`);

    if (score > 80) scorePath.className.baseVal = "circle color-green";
    else if (score > 50) scorePath.className.baseVal = "circle color-yellow";
    else scorePath.className.baseVal = "circle color-red";
  };

  const runPageSpeedAudit = async (url) => {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`;
    
    try {
      const response = await fetch(apiUrl);
      const json = await response.json();
      
      const perf = Math.round(json.lighthouseResult.categories.performance.score * 100);
      const lcp = json.lighthouseResult.audits['largest-contentful-paint'].displayValue;
      const cls = json.lighthouseResult.audits['cumulative-layout-shift'].displayValue;
      const inp = json.lighthouseResult.audits['interactive']?.displayValue || "N/A";

      pageSpeedData = { perf, lcp, cls, inp };

      document.getElementById("perf-score").textContent = perf;
      document.getElementById("lcp-val").textContent = lcp;
      document.getElementById("cls-val").textContent = cls;
      document.getElementById("inp-val").textContent = inp;
      
      // Update Progress Bars
      document.getElementById("perf-progress").style.width = `${perf}%`;
      document.getElementById("perf-progress").className = `metric-progress bg-${perf > 70 ? 'green' : (perf > 40 ? 'yellow' : 'red')}`;
      
      document.getElementById("lcp-progress").style.width = '100%';
      document.getElementById("lcp-progress").className = `metric-progress bg-green`;
      
      document.getElementById("cls-progress").style.width = '100%';
      document.getElementById("cls-progress").className = `metric-progress bg-green`;
      
      document.getElementById("inp-progress").style.width = '100%';
      document.getElementById("inp-progress").className = `metric-progress bg-green`;

      // Update score with PageSpeed results (+20 if > 70)
      if (perf > 70) {
        const currentScore = parseInt(document.getElementById("overall-score").textContent);
        updateCircularScore(currentScore + 20);
      }
      
      // Update status badge
      document.getElementById("status-badge").textContent = "Active Tab";
      document.getElementById("status-badge").style.background = "#DCFCE7";
      document.getElementById("status-badge").style.color = "#166534";

      // Remove loading states
      document.querySelectorAll(".metric-card").forEach(c => c.classList.remove("loading"));
    } catch (e) {
      console.error("PageSpeed Error", e);
      document.querySelectorAll(".metric-card .value").forEach(v => v.textContent = "Err");
      document.getElementById("status-badge").textContent = "API Error";
    }
  };

  const mockAudit = () => {
    document.getElementById("scanned-url").textContent = "https://example.com (Preview Mode)";
    auditData = {
      title: "Example SEO Friendly Page Title",
      titleLength: 32,
      metaDescription: "This is a great meta description that summarizes the page perfectly for users.",
      metaDescriptionLength: 75,
      h1s: ["Main Heading One"],
      h2s: ["Sub Heading"],
      h3s: ["Third Level"],
      missingAltImages: [],
      canonicalUrl: "https://example.com/",
      internalCount: 25,
      externalCount: 5,
      wordCount: 1250
    };
    processAudit(auditData);
    
    // Simulate PageSpeed loading
    setTimeout(() => {
      pageSpeedData = { perf: 95, lcp: "1.2s", cls: "0.01", inp: "150ms" };
      document.getElementById("perf-score").textContent = "95";
      document.getElementById("lcp-val").textContent = "1.2s";
      document.getElementById("cls-val").textContent = "0.01";
      document.getElementById("inp-val").textContent = "150ms";
      
      document.getElementById("perf-progress").style.width = `95%`;
      document.getElementById("perf-progress").className = `metric-progress bg-green`;
      document.getElementById("lcp-progress").style.width = '100%';
      document.getElementById("lcp-progress").className = `metric-progress bg-green`;
      document.getElementById("cls-progress").style.width = '100%';
      document.getElementById("cls-progress").className = `metric-progress bg-green`;
      document.getElementById("inp-progress").style.width = '100%';
      document.getElementById("inp-progress").className = `metric-progress bg-green`;

      document.querySelectorAll(".metric-card").forEach(c => c.classList.remove("loading"));
      
      const currentScore = parseInt(document.getElementById("overall-score").textContent);
      updateCircularScore(currentScore + 20);

      document.getElementById("status-badge").textContent = "Preview Mode";
      document.getElementById("status-badge").style.background = "#F1F5F9";
      document.getElementById("status-badge").style.color = "#64748B";
    }, 1500);
  };

  const showError = (msg) => {
    document.body.innerHTML = `<div style="padding:40px; text-align:center;"><p>${msg}</p><button onclick="window.location.reload()">Retry</button></div>`;
  };

  // --- Export Actions ---
  document.getElementById("btn-export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ audit: auditData, metrics: pageSpeedData }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-audit-report.json";
    a.click();
  });

  document.getElementById("btn-export-txt").addEventListener("click", () => {
    const text = `SEO AUDIT REPORT\nURL: ${document.getElementById("scanned-url").textContent}\n\nOVERALL SCORE: ${document.getElementById("overall-score").textContent}/100\n\nTITLE: ${auditData.title}\nDESC: ${auditData.metaDescription}\nWORDS: ${auditData.wordCount}\n\nPERFORMANCE: ${pageSpeedData?.perf || 'Pending'}%`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-audit-report.txt";
    a.click();
  });

  init();
});
