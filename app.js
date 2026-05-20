const state = {
  data: null,
  artists: [],
  filtered: [],
  selectedId: null
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const riskClass = (n) => n < 20 ? 'risk-low' : n < 28 ? 'risk-mid' : 'risk-high';
const fmtPct = (n) => `${Math.round(n || 0)}%`;

function scoreArtist(artist) {
  const w = state.data.scoringWeights || { commercialValue: .3, categoryFit: .25, riskControl: .2, heatTrend: .15, partnershipHistory: .1 };
  return Math.round(
    (artist.commercialValue || 0) * w.commercialValue +
    (artist.categoryFit || 0) * w.categoryFit +
    (100 - (artist.riskLevel || 0)) * w.riskControl +
    (artist.heatTrend || 0) * w.heatTrend +
    (artist.partnershipHistory || 0) * w.partnershipHistory
  );
}

function categories() {
  const set = new Set(['全部品类']);
  state.artists.forEach((a) => (a.category || []).forEach((c) => set.add(c)));
  return [...set];
}

function applyFilters() {
  const keyword = $('searchInput').value.trim().toLowerCase();
  const category = $('categoryFilter').value;
  const riskMode = $('riskFilter').value;

  state.filtered = state.artists
    .map((artist) => ({ ...artist, finalScore: scoreArtist(artist) }))
    .filter((artist) => {
      const hay = [artist.name, artist.role, artist.bestUse, artist.recentSignal, ...(artist.category || []), ...(artist.riskTags || []), ...(artist.evidence || [])].join(' ').toLowerCase();
      if (keyword && !hay.includes(keyword)) return false;
      if (category !== '全部品类' && !(artist.category || []).includes(category)) return false;
      if (riskMode === 'safe' && artist.riskLevel >= 22) return false;
      if (riskMode === 'balanced' && (artist.riskLevel < 18 || artist.riskLevel > 28)) return false;
      if (riskMode === 'aggressive' && artist.heatTrend < 85) return false;
      return true;
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  if (!state.filtered.find((a) => a.id === state.selectedId)) state.selectedId = state.filtered[0]?.id || null;
  render();
}

function selectedArtist() {
  return state.filtered.find((a) => a.id === state.selectedId) || state.filtered[0] || null;
}

function renderHeaderMetrics() {
  $('metricArtists').textContent = state.filtered.length;
  $('metricSignals').textContent = (state.data.businessSignals || []).length;
  $('metricSafe').textContent = state.filtered.filter((a) => a.riskLevel < 22).length;
  $('metricFlow').textContent = state.data.dataFlowVersion || 'v?';
  $('modeChip').textContent = state.data.status || 'json';
}

function renderSnapshot() {
  const top = selectedArtist();
  const topSignal = (state.data.businessSignals || [])[0];
  $('topPickName').textContent = top ? `${top.name} · ${top.finalScore}` : '暂无候选';
  $('topPickReason').textContent = top ? (top.evidence || []).slice(0, 2).join('；') : '暂无数据';
  $('topRisk').textContent = top ? (top.riskTags?.[0] || '低风险') : '—';
  $('topRiskAdvice').textContent = top ? `建议先确认 ${top.riskTags?.join('、') || '档期与竞品排他'}。` : '—';
  $('bestCategory').textContent = topSignal?.title || '—';
  $('bestCategoryNote').textContent = topSignal?.summary || '—';
}

function renderSignals() {
  const signals = state.data.businessSignals || [];
  $('signalFeed').innerHTML = signals.map((s) => `
    <article class="feed-item">
      <span class="chip pink">${esc(s.type)}</span>
      <h4>${esc(s.title)}</h4>
      <p>${esc(s.summary)}</p>
      <span class="chip green">${esc(s.date)}</span>
      <span class="chip">${esc(s.metric)}</span>
    </article>
  `).join('') || '<div class="empty">暂无情报信号</div>';
}

function renderWatchlist() {
  $('watchlist').innerHTML = state.filtered.slice(0, 4).map((artist, i) => `
    <div class="watch">
      <div>
        <strong>${i + 1}. ${esc(artist.name)}</strong>
        <div class="mini">${esc(artist.role)} · ${esc(artist.bestUse || '')}</div>
      </div>
      <div class="score">${artist.finalScore}</div>
    </div>
  `).join('') || '<div class="empty">没有匹配结果</div>';
}

function renderTable() {
  $('artistRows').innerHTML = state.filtered.map((artist) => `
    <tr data-id="${esc(artist.id)}">
      <td><strong>${esc(artist.name)}</strong><br><span class="mini">${esc(artist.role)}</span></td>
      <td>${(artist.category || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</td>
      <td><span class="score">${artist.finalScore}</span></td>
      <td>${artist.commercialValue}</td>
      <td>${artist.heatTrend}</td>
      <td class="${riskClass(artist.riskLevel)}">${artist.riskLevel} / ${(artist.riskTags || []).join('；')}</td>
      <td>${esc(artist.bestUse || artist.recentSignal || '')}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty">没有符合筛选条件的艺人</td></tr>';

  document.querySelectorAll('#artistRows tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedId = row.dataset.id;
      renderDetail();
      renderSnapshot();
      renderCompare();
      window.location.hash = '#bi';
    });
  });
}

function renderDetail() {
  const artist = selectedArtist();
  if (!artist) {
    $('detailPanel').innerHTML = '<div class="empty">请选择艺人查看 BI 分析。</div>';
    $('reportBox').textContent = '暂无报告';
    return;
  }

  $('detailPanel').innerHTML = `
    <div>
      <span class="chip blue">Selected Artist</span>
      <h3 style="margin:10px 0 6px">${esc(artist.name)} · ${esc(artist.role)}</h3>
      <div class="mini">${esc(artist.audience || '')}</div>
    </div>
    <div class="bars">
      ${[
        ['商业价值', artist.commercialValue],
        ['品类适配', artist.categoryFit],
        ['热度趋势', artist.heatTrend],
        ['合作履历', artist.partnershipHistory],
        ['风险控制', 100 - artist.riskLevel]
      ].map(([label, value]) => `
        <div class="barrow"><span>${label}</span><div class="bar"><span style="width:${value}%"></span></div><b>${value}</b></div>
      `).join('')}
    </div>
    <div class="cards2">
      <div class="card"><h4>推荐依据</h4><p>${(artist.evidence || []).map(esc).join('；')}</p></div>
      <div class="card"><h4>风险提示</h4><p>${(artist.riskTags || []).map(esc).join('；')}</p></div>
    </div>
    <div class="card"><h4>最近商务观察</h4><p>${esc(artist.recentSignal || '')}</p></div>
  `;

  $('reportBox').textContent = `StarClaw Insight Brief\n\n候选艺人：${artist.name}（${artist.role}）\nStarClaw Score：${artist.finalScore}\n适用品类：${(artist.category || []).join(' / ')}\n目标人群：${artist.audience || '—'}\n\n推荐依据：\n- ${(artist.evidence || []).join('\n- ')}\n\n风险提示：\n- ${(artist.riskTags || []).join('\n- ')}\n\n建议打法：\n${artist.bestUse || artist.recentSignal || ''}\n\n数据流：${state.data.dataFlowVersion} / ${state.data.status}\n下一步：加入 shortlist → 去 /match 做品牌匹配 → 去 /business-summary 导出报告。`;
}

function renderCompare() {
  const picks = state.filtered.slice(0, 3);
  $('compareCards').innerHTML = picks.map((artist) => `
    <div class="card">
      <span class="chip blue">${esc(artist.name)}</span>
      <h4 style="margin-top:10px">Score ${artist.finalScore}</h4>
      <p>${esc(artist.bestUse || '')}</p>
      <div class="mini">风险：${(artist.riskTags || []).join('；')}</div>
    </div>
  `).join('') || '<div class="empty">暂无候选</div>';
}

function renderPipeline() {
  $('pipelineCards').innerHTML = (state.data.pipeline || []).map((step) => `
    <div class="card">
      <span class="chip ${step.status === 'online' ? 'green' : 'amber'}">${esc(step.status)}</span>
      <h4 style="margin-top:10px">${esc(step.name)}</h4>
      <p>${esc(step.description)}</p>
    </div>
  `).join('');
}

function render() {
  renderHeaderMetrics();
  renderSnapshot();
  renderSignals();
  renderWatchlist();
  renderTable();
  renderDetail();
  renderCompare();
  renderPipeline();
}

async function init() {
  const res = await fetch('/data.json', { cache: 'no-store' });
  state.data = await res.json();
  state.artists = state.data.artists || [];
  $('categoryFilter').innerHTML = categories().map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('searchInput').addEventListener('input', applyFilters);
  $('categoryFilter').addEventListener('change', applyFilters);
  $('riskFilter').addEventListener('change', applyFilters);
  $('copyReportBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('reportBox').textContent);
    $('copyReportBtn').textContent = '已复制';
    setTimeout(() => $('copyReportBtn').textContent = '复制摘要', 1500);
  });
  applyFilters();
}

init().catch((err) => {
  document.querySelector('.content').innerHTML = `<div class="panel empty">数据加载失败：${esc(err.message)}</div>`;
});