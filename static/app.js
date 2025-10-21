const state = {
  user: null,
  jobs: [],
  settings: {
    pageSize: localStorage.getItem('epub:pageSize') || 'A4',
    marginMm: Number(localStorage.getItem('epub:marginMm') || 15),
  },
  autoRefresh: true,
  refreshTimer: null,
  uploading: false,
};

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const jobsList = document.getElementById('jobs-list');
const jobsEmpty = document.getElementById('jobs-empty');
const statTotal = document.getElementById('stat-total');
const statCompleted = document.getElementById('stat-completed');
const statPending = document.getElementById('stat-pending');
const refreshJobsBtn = document.getElementById('refresh-jobs');
const clearJobsBtn = document.getElementById('clear-jobs');
const autoRefreshToggle = document.getElementById('auto-refresh');
const toastContainer = document.getElementById('toast');

const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const cancelSettingsBtn = document.getElementById('settings-cancel');
const saveSettingsBtn = document.getElementById('settings-save');
const settingsNameInput = document.getElementById('settings-name');
const settingsPageSelect = document.getElementById('settings-page');
const settingsMarginInput = document.getElementById('settings-margin');
const displayNameEl = document.getElementById('display-name');

async function init() {
  settingsNameInput.value = window.__INITIAL_DISPLAY_NAME || '';
  settingsPageSelect.value = state.settings.pageSize;
  settingsMarginInput.value = state.settings.marginMm;

  await fetchSession();
  await refreshJobs();
  setupAutoRefresh();
}

function setupAutoRefresh() {
  if (state.autoRefresh) {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(refreshJobs, 5000);
  } else if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

async function fetchSession() {
  const res = await fetch('/api/session');
  if (!res.ok) return;
  const data = await res.json();
  state.user = data;
  if (data.displayName) {
    displayNameEl.textContent = data.displayName;
    settingsNameInput.value = data.displayName;
  }
}

async function refreshJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) {
    showToast('获取任务列表失败', 'error');
    return;
  }
  const data = await res.json();
  state.jobs = data.jobs || [];
  renderJobs();
}

function renderJobs() {
  if (!state.jobs.length) {
    jobsList.innerHTML = '';
    jobsEmpty.classList.remove('hidden');
  } else {
    jobsEmpty.classList.add('hidden');
    jobsList.innerHTML = state.jobs.map(renderJobCard).join('');
  }

  const total = state.jobs.length;
  const completed = state.jobs.filter((job) => job.status === 'completed').length;
  const pending = state.jobs.filter((job) => ['queued', 'processing'].includes(job.status)).length;

  statTotal.textContent = total;
  statCompleted.textContent = completed;
  statPending.textContent = pending;
}

function renderJobCard(job) {
  const statusMeta = statusInfo(job.status);
  const created = formatDate(job.createdAt);
  const updated = job.updatedAt ? formatDate(job.updatedAt) : '—';
  const size = job.sizeBytes ? formatSize(job.sizeBytes) : '未知';

  const actions = [];
  if (job.downloadUrl) {
    actions.push(`<a href="${job.downloadUrl}" class="action-btn bg-emerald-500/90 hover:bg-emerald-400" download>下载 PDF</a>`);
  }
  if (['failed', 'completed', 'canceled'].includes(job.status)) {
    actions.push(`<button data-action="retry" data-id="${job.id}" class="action-btn bg-cyan-500/90 hover:bg-cyan-400">重新转换</button>`);
  }
  if (job.status === 'processing') {
    actions.push(`<button data-action="cancel" data-id="${job.id}" class="action-btn bg-amber-500/90 hover:bg-amber-400">取消</button>`);
  }
  if (job.status !== 'processing') {
    actions.push(`<button data-action="delete" data-id="${job.id}" class="action-btn bg-slate-800/80 hover:bg-slate-700">删除</button>`);
  }

  return `
    <article class="rounded-2xl border border-white/10 bg-slate-900/40 p-5 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">${escapeHtml(job.originalFilename)}</h3>
          <p class="text-xs text-slate-400">创建于 ${created} · 上次更新 ${updated}</p>
        </div>
        <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badge}">${statusMeta.label}</span>
      </div>
      <div class="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
        <div>文件大小：${size}</div>
        <div>纸张：${job.settings?.pageSize || 'A4'} · 边距：${job.settings?.marginMm ?? 15}mm</div>
      </div>
      ${job.error ? `<div class="text-sm text-rose-300">错误：${escapeHtml(job.error)}</div>` : ''}
      <div class="flex flex-wrap gap-3">
        ${actions.join('') || '<span class="text-sm text-slate-500">暂无可用操作</span>'}
      </div>
    </article>
  `;
}

function statusInfo(status) {
  switch (status) {
    case 'queued':
      return { label: '排队中', badge: 'bg-slate-800/80 text-cyan-300 border border-cyan-500/20' };
    case 'processing':
      return { label: '转换中', badge: 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 animate-pulse' };
    case 'completed':
      return { label: '已完成', badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' };
    case 'failed':
      return { label: '失败', badge: 'bg-rose-500/20 text-rose-200 border border-rose-500/30' };
    case 'canceled':
      return { label: '已取消', badge: 'bg-amber-500/20 text-amber-200 border border-amber-500/30' };
    default:
      return { label: status, badge: 'bg-slate-600/30 text-slate-200' };
  }
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatSize(bytes) {
  if (!Number(bytes)) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function escapeHtml(str) {
  return str?.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) || '';
}

async function handleUpload(files) {
  if (!files || !files.length || state.uploading) return;
  const file = files[0];
  if (!file.name.toLowerCase().endsWith('.epub')) {
    showToast('仅支持 EPUB 文件', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('pageSize', state.settings.pageSize);
  formData.append('margin', state.settings.marginMm);

  state.uploading = true;
  showToast('上传中，请稍候…', 'info');
  try {
    const res = await fetch('/api/jobs', { method: 'POST', body: formData });
    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || '上传失败');
    }
    const data = await res.json();
    state.jobs.unshift(data.job);
    renderJobs();
    showToast('任务已加入队列', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.uploading = false;
    fileInput.value = '';
    refreshJobs();
  }
}

async function handleJobAction(action, id) {
  if (!id) return;
  if (action === 'retry') {
    const res = await fetch(`/api/jobs/${id}/retry`, { method: 'POST' });
    if (!res.ok) {
      showToast('无法重新转换', 'error');
      return;
    }
    showToast('已重新加入队列', 'success');
    await refreshJobs();
  } else if (action === 'delete' || action === 'cancel') {
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('操作失败', 'error');
      return;
    }
    const data = await res.json();
    showToast(data.message || '操作成功', 'success');
    await refreshJobs();
  }
}

async function handleClearJobs() {
  if (!confirm('确定要清空所有历史记录吗？')) return;
  const res = await fetch('/api/jobs', { method: 'DELETE' });
  if (!res.ok) {
    showToast('清空失败', 'error');
    return;
  }
  showToast('已清空历史记录', 'success');
  await refreshJobs();
}

function showSettings() {
  settingsModal.classList.remove('hidden');
  settingsModal.classList.add('flex');
  settingsNameInput.focus();
}

function hideSettings() {
  settingsModal.classList.add('hidden');
  settingsModal.classList.remove('flex');
  settingsNameInput.value = state.user?.displayName || '';
}

async function saveSettings() {
  const displayName = settingsNameInput.value.trim();
  const pageSize = settingsPageSelect.value;
  const marginMm = Number(settingsMarginInput.value) || 15;

  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  if (res.ok) {
    const data = await res.json();
    state.user.displayName = data.displayName;
    displayNameEl.textContent = data.displayName || '新用户';
    showToast('用户信息已更新', 'success');
  }

  state.settings.pageSize = pageSize;
  state.settings.marginMm = marginMm;
  localStorage.setItem('epub:pageSize', pageSize);
  localStorage.setItem('epub:marginMm', marginMm.toString());
  hideSettings();
}

function showToast(message, variant = 'info') {
  toastContainer.innerHTML = `<div class="rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${toastTone(variant)}">${escapeHtml(message)}</div>`;
  toastContainer.classList.remove('hidden');
  setTimeout(() => toastContainer.classList.add('hidden'), 2400);
}

function toastTone(variant) {
  switch (variant) {
    case 'success':
      return 'bg-emerald-500/90 text-emerald-950';
    case 'error':
      return 'bg-rose-500/90 text-rose-950';
    case 'info':
    default:
      return 'bg-slate-200 text-slate-900';
  }
}

// Event wiring
dropZone.addEventListener('click', () => fileInput.click());
uploadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => handleUpload(event.target.files));

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add('border-cyan-400', 'bg-slate-900/50');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('border-cyan-400', 'bg-slate-900/50');
  });
});

dropZone.addEventListener('drop', (event) => {
  const files = event.dataTransfer.files;
  handleUpload(files);
});

jobsList.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  handleJobAction(action, id);
});

refreshJobsBtn.addEventListener('click', refreshJobs);
clearJobsBtn.addEventListener('click', handleClearJobs);
autoRefreshToggle.addEventListener('change', (event) => {
  state.autoRefresh = event.target.checked;
  setupAutoRefresh();
});

openSettingsBtn.addEventListener('click', showSettings);
closeSettingsBtn.addEventListener('click', hideSettings);
cancelSettingsBtn.addEventListener('click', hideSettings);
saveSettingsBtn.addEventListener('click', saveSettings);

init().catch((error) => {
  console.error(error);
  showToast('初始化失败', 'error');
});
