const DATA_PATHS = ['/data.json', '/stars/data.json'];

const fallback = {
  updatedAt: 'fallback',
  dataFlowVersion: 'fallback',
  status: 'data_load_failed',
  sourceNote: '数据加载失败，当前展示空状态。',
  scoringWeights: { commercialValue: 0.3, categoryFit: 0.25, riskControl: 0.2, heatTrend: 0.15, partnershipHistory: 0.1 },
  businessSignals: [],
  pipeline: [],
  artists: []
};

let state = {
  data: fallback,
  artists: [],
  selected: null,
  shortlist: new Set(),
  dataPath: 'fallback'
};

const $ = (id) => document.getElementById(id);
const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function weights() {
  return state.data.scoringWeights || fallback.scoringWeights;
}

function scoreArtist(artist) {
  const w = weights();
  return Math.round(
    (artist.commercialValue || 0) * (w.commercialValue || 0) +
    (artist.categoryFit || 0) * (w.categoryFit || 0) +
    (100 - (artist.riskLevel || 0)) * (w.riskControl || 0) +
    (artist.heatTrend || 0) * (w.heatTrend || 0) +
    (artist.partnershipHistory || 0) * (w.partnershipHistory || 0)
  );
}

function rankedArtists() {
  const category = $('category').value;
  const risk = $('risk').value;
  return state.artists
    .filter((artist) => risk === 'all' || (risk === 'low' ? artist.riskLevel < 25 : artist.riskLevel >= 25))
    .map((artist) => ({ ...artist, finalScore: scoreArtist(artist) + (artist.category.includes(category) ? 6 : 0) }))
    .sort((a, b) => b.finalScore - a.finalScore);
}

function renderSignals() {
  const signals = state.data.businessSignals || [];
  $('signalsGrid').innerHTML = signals.map((signal) => `
    <article class="signal">
      <span class="pill blue">${esc(signal.type)}</span>
      <h3>${esc(signal.title)}</h3>
      <p>${esc(signal.summary)}</p>
      <span class="pill green">${esc(signal.date)}</span><span class="pill">${esc(signal.metric)}</span>
    </article>
  `).join('') || '<div class="card">暂无情报信号</div>';
}

function renderPipeline() {
  const pipeline = state.data.pipeline || [];
  $('pipelineGrid').innerHTML = pipeline.map((step) => `
    <div class="step">
      <b>${esc(step.name)}</b><br>
      <span class="pill ${step.status === 'online' ? 'green' : 'blue'}">${esc(step.status)}</span>
      <p>${esc(step.description)}</p>
    </div>
  `).join('');
}

function renderArtists(ranked) {
  $('artistGrid').innerHTML = ranked.map((artist) => `
    <article class="artist ${artist.id === state.selected ? 'active' : ''}" data-id="${esc(artist.id)}">
      <div class="avatar">${esc(artist.name[0])}</div>
      <h3>${esc(artist.name)}</h3>
      <p>${esc(artist.role)}</p>
      <div class="score">${artist.finalScore}</div>
      ${artist.category.slice(0, 3).map((c) => `<span class="pill">${esc(c)}</span>`).join('')}
      <button class="mini" data-shortlist="${esc(artist.id)}">${state.shortlist.has(artist.id) ? '已入候选池' : '加入候选池'}</button>
    </article>
  `).join('');

  document.querySelectorAll('.artist').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.target?.dataset?.shortlist) return;
      state.selected = el.dataset.id;
      render();
    });
  });
  document.querySelectorAll('[data-shortlist]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = button.dataset.shortlist;
      if (state.shortlist.has(id)) state.shortlist.delete(id);
      else if (state.shortlist.size < 3) state.shortlist.add(id);
      else alert('Demo 候选池最多先放 3 位，便于品牌内部讨论。');
      render();
    });
  });
}

function renderCompare(ranked) {
  const compare = state.shortlist.size
    ? ranked.filter((artist) => state.shortlist.has(artist.id))
    : ranked.slice(0, 5);

  $('compareRows').innerHTML = compare.map((artist) => `
    <tr class="data-row">
      <td><b>${esc(artist.name)}</b><br><span class="pill">${esc(artist.role)}</span></td>
      <td><b>${artist.finalScore}</b></td>
      <td>${artist.category.map(esc).join(' / ')}</td>
      <td>${esc(artist.audience)}</td>
      <td>${esc(artist.recentSignal)}</td>
      <td class="risk ${artist.riskLevel < 25 ? 'low' : 'mid'}">${artist.riskTags.map(esc).join('；')}</td>
    </tr>
  `).join('');

  $('shortlistNote').textContent = state.shortlist.size
    ? `当前候选池：${compare.map((a) => a.name).join('、')}`
    : '未手动加入候选池时，默认展示当前品类 Top 5。';
}

function reportFor(pick) {
  if (!pick) return '';
  return `StarClaw 品牌代言初筛报告（Demo）\n\n品牌需求：${$('category').value} / ${$('budget').value}\n风险偏好：${$('risk').selectedOptions[0].textContent}\n目标人群：${$('audience').value}\nCampaign 目标：${$('goal').value}\n\n推荐艺人：${pick.name}（${pick.role}）\nStarClaw Score：${pick.finalScore}\n\n推荐依据：\n- ${pick.evidence.join('\n- ')}\n\n风险尽调：\n- ${pick.riskTags.join('\n- ')}\n\n数据来源：${state.dataPath} / ${state.data.dataFlowVersion}\n下一步：确认档期、报价、竞品排他与近期舆情，再进入商务沟通。`;
}

function render() {
  const ranked = rankedArtists();
  state.selected = state.selected || ranked[0]?.id;
  const pick = ranked.find((artist) => artist.id === state.selected) || ranked[0];
  const w = weights();

  $('mArtists').textContent = state.artists.length;
  $('mSignals').textContent = (state.data.businessSignals || []).length;
  $('mFlow').textContent = state.data.dataFlowVersion || 'v?';
  $('weightText').textContent = `商业价值 ${pct(w.commercialValue)} · 品类匹配 ${pct(w.categoryFit)} · 风险控制 ${pct(w.riskControl)} · 热度趋势 ${pct(w.heatTrend)} · 合作履历 ${pct(w.partnershipHistory)}。权重来自 data.json。`;
  $('dataPathText').textContent = state.dataPath;

  renderSignals();
  renderPipeline();
  renderArtists(ranked);
  renderCompare(ranked);

  $('topPick').textContent = pick
    ? `当前首选：${pick.name}\n推荐分：${pick.finalScore}\n推荐理由：${pick.evidence.join('；')}\n风险提示：${pick.riskTags.join('；')}`
    : '暂无数据';
  $('reportText').textContent = reportFor(pick);
  $('dataFlowText').textContent = `当前数据流：${state.dataPath} → app.js → 页面组件\nSchema：${state.data.schemaVersion}\n状态：${state.data.status}\n更新时间：${state.data.updatedAt}\n说明：${state.data.sourceNote}`;
}

async function loadData() {
  for (const path of DATA_PATHS) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      state.data = data;
      state.artists = data.artists || [];
      state.dataPath = path;
      state.selected = null;
      render();
      return;
    } catch (err) {
      // Try next data path.
    }
  }
  state.data = fallback;
  state.artists = [];
  state.dataPath = 'fallback';
  render();
}

['category', 'budget', 'risk', 'audience', 'goal'].forEach((id) => {
  $(id).addEventListener('input', () => {
    state.selected = null;
    render();
  });
});

$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('reportText').textContent);
  $('copyBtn').textContent = '已复制';
});

loadData();
