const translations = {
  en: {
    headerTitle: 'EPUB → PDF Conversion Hub',
    headerSubtitle: 'Lightning-fast conversions that preserve bilingual layouts and high-resolution images.',
    currentUserLabel: 'Current User',
    settingsButton: 'Settings',
    uploadHeading: 'Upload EPUB',
    uploadSubheading: 'Supports bilingual content and HD imagery up to 150 MB per file.',
    dropTitle: 'Drag EPUB files here or click to browse',
    dropSubtitle: 'Files enter the queue automatically—track progress and history in one place.',
    chooseFileButton: 'Choose EPUB',
    statTotalLabel: 'Total Jobs',
    statCompletedLabel: 'Completed',
    statPendingLabel: 'Queued',
    actionsHeading: 'Actions',
    refreshButton: 'Refresh List',
    clearButton: 'Clear History',
    actionsTip1: 'Uploads enter the queue automatically. Sign in on the same browser to keep your history.',
    actionsTip2: 'Need custom page size or margins? Adjust them from Settings before uploading.',
    historyHeading: 'Queue & History',
    historySubtitle: 'Newest jobs appear first. Download PDFs or retry any conversion.',
    autoRefreshLabel: 'Auto Refresh',
    emptyState: 'No conversions yet—upload an EPUB to get started.',
    settingsTitle: 'Personal Settings',
    settingsNameLabel: 'Display Name',
    settingsNamePlaceholder: 'Name for your history',
    settingsPageLabel: 'Default Page Size',
    settingsMarginLabel: 'Margins (mm)',
    settingsMarginLabelShort: 'Margins',
    settingsCancel: 'Cancel',
    settingsSave: 'Save',
    onlyEpubAllowed: 'Only EPUB files are allowed.',
    jobFileSize: 'File Size',
    jobPaperSettings: 'Paper & margins',
    statusQueued: 'Queued',
    statusProcessing: 'Processing',
    statusCompleted: 'Completed',
    statusFailed: 'Failed',
    statusCanceled: 'Canceled',
    actionDownload: 'Download PDF',
    actionReveal: 'Open Folder',
    actionRetry: 'Retry',
    actionCancel: 'Cancel',
    actionDelete: 'Delete',
    noActions: 'No available actions',
    sizeUnknown: 'Unknown size',
    jobCreatedAt: 'Created on',
    jobUpdatedAt: 'Updated on',
    toastUploadPending: 'Uploading…',
    toastUploadSuccess: 'Job added to queue',
    toastUploadErrorPrefix: 'Upload failed',
    toastServerUnavailable: 'Server unavailable. Is the app running?',
    toastRevealSuccess: 'Opened in file explorer',
    toastOperationSuccess: 'Operation succeeded',
    toastOperationFailed: 'Action failed',
    toastRefreshFailed: 'Unable to refresh jobs',
    toastSettingsSaved: 'Preferences updated',
    toastClearSuccess: 'History cleared',
    toastLanguageChanged: 'Language switched',
    confirmClear: 'This will remove all jobs. Continue?',
  },
  zh: {
    headerTitle: 'EPUB → PDF 转换中心',
    headerSubtitle: '极速转换，保留中英文排版与高清图片，让你的电子书随时打印阅读。',
    currentUserLabel: '当前用户',
    settingsButton: '个人设置',
    uploadHeading: '上传 EPUB',
    uploadSubheading: '支持中英文混排与高清图片，单个文件 ≤ 150MB。',
    dropTitle: '拖拽 EPUB 文件到此或点击浏览',
    dropSubtitle: '上传后自动排队，可随时查看进度与历史记录。',
    chooseFileButton: '选择 EPUB',
    statTotalLabel: '总任务',
    statCompletedLabel: '已完成',
    statPendingLabel: '排队中',
    actionsHeading: '操作',
    refreshButton: '刷新列表',
    clearButton: '清空历史',
    actionsTip1: '上传后任务会自动进入队列。使用同一浏览器即可继续查看历史记录。',
    actionsTip2: '若需自定义纸张或页边距，请先在设置中调整。',
    historyHeading: '转换队列与历史',
    historySubtitle: '最新任务显示在最前，可点击下载 PDF 或重新转换。',
    autoRefreshLabel: '自动刷新',
    emptyState: '还没有转换记录，上传 EPUB 开始体验吧！',
    settingsTitle: '个性化设置',
    settingsNameLabel: '显示名称',
    settingsNamePlaceholder: '用于历史记录的昵称',
    settingsPageLabel: '默认纸张尺寸',
    settingsMarginLabel: '页边距 (毫米)',
    settingsMarginLabelShort: '页边距',
    settingsCancel: '取消',
    settingsSave: '保存',
    onlyEpubAllowed: '仅支持 EPUB 格式。',
    jobFileSize: '文件大小',
    jobPaperSettings: '纸张与边距',
    statusQueued: '排队中',
    statusProcessing: '转换中',
    statusCompleted: '已完成',
    statusFailed: '失败',
    statusCanceled: '已取消',
    actionDownload: '下载 PDF',
    actionReveal: '打开文件夹',
    actionRetry: '重新转换',
    actionCancel: '取消',
    actionDelete: '删除',
    noActions: '暂无可用操作',
    sizeUnknown: '未知大小',
    jobCreatedAt: '创建于',
    jobUpdatedAt: '上次更新',
    toastUploadPending: '上传中…',
    toastUploadSuccess: '任务已加入队列',
    toastUploadErrorPrefix: '上传失败',
    toastServerUnavailable: '服务器不可用，请确认服务已启动。',
    toastRevealSuccess: '已在文件夹中显示',
    toastOperationSuccess: '操作成功',
    toastOperationFailed: '操作失败',
    toastRefreshFailed: '任务列表刷新失败',
    toastSettingsSaved: '设置已更新',
    toastClearSuccess: '已清空历史记录',
    toastLanguageChanged: '语言已切换',
    confirmClear: '将删除所有任务，确定继续？',
  },
};

const state = {
  user: null,
  jobs: [],
  settings: {
    pageSize: localStorage.getItem('epub:pageSize') || 'A4',
    marginMm: Number(localStorage.getItem('epub:marginMm') || 15),
  },
  locale: localStorage.getItem('epub:locale') || 'en',
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
const localeToggle = document.getElementById('locale-toggle');

async function init() {
  settingsNameInput.value = window.__INITIAL_DISPLAY_NAME || '';
  settingsPageSelect.value = state.settings.pageSize;
  settingsMarginInput.value = state.settings.marginMm;

  applyTranslations();
  await fetchSession();
  await refreshJobs();
  setupAutoRefresh();
}

function t(key) {
  return translations[state.locale]?.[key] ?? translations.en[key] ?? key;
}

function applyTranslations() {
  document.documentElement.lang = state.locale === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });
  settingsNameInput.placeholder = t('settingsNamePlaceholder');
  localeToggle.textContent = state.locale === 'en' ? '中文' : 'English';
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
  const res = await fetch('/api/session', { credentials: 'include' });
  if (!res.ok) return;
  const data = await res.json();
  state.user = data;
  if (data.displayName) {
    displayNameEl.textContent = data.displayName;
    settingsNameInput.value = data.displayName;
  }
}

async function refreshJobs() {
  try {
    const res = await fetch('/api/jobs', { credentials: 'include' });
    if (!res.ok) {
      showToast(t('toastRefreshFailed'), 'error');
      return;
    }
    const data = await res.json();
    state.jobs = data.jobs || [];
    renderJobs();
  } catch (error) {
    showToast(t('toastRefreshFailed'), 'error');
  }
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
  const size = job.sizeBytes ? formatSize(job.sizeBytes) : t('sizeUnknown');

  const actions = [];
  const fileSizeLabel = t('jobFileSize');
  const paperLabel = t('jobPaperSettings');
  const marginLabel = t('settingsMarginLabelShort');
  if (job.downloadUrl) {
    actions.push(`<a href="${job.downloadUrl}" class="action-btn bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400" download>${t('actionDownload')}</a>`);
    actions.push(`<button data-action="reveal" data-id="${job.id}" class="action-btn bg-sky-500/90 text-slate-950 hover:bg-sky-400">${t('actionReveal')}</button>`);
  }
  if (['failed', 'completed', 'canceled'].includes(job.status)) {
    actions.push(`<button data-action="retry" data-id="${job.id}" class="action-btn bg-cyan-500/90 text-slate-950 hover:bg-cyan-400">${t('actionRetry')}</button>`);
  }
  if (job.status === 'processing') {
    actions.push(`<button data-action="cancel" data-id="${job.id}" class="action-btn bg-amber-500/90 text-amber-950 hover:bg-amber-400">${t('actionCancel')}</button>`);
  }
  if (job.status !== 'processing') {
    actions.push(`<button data-action="delete" data-id="${job.id}" class="action-btn bg-rose-500 text-rose-950 hover:bg-rose-400">${t('actionDelete')}</button>`);
  }

  return `
    <article class="rounded-2xl border border-white/10 bg-slate-900/40 p-5 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">${escapeHtml(job.originalFilename)}</h3>
          <p class="text-xs text-slate-400">${t('jobCreatedAt')} ${created} · ${t('jobUpdatedAt')} ${updated}</p>
        </div>
        <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badge}">${statusMeta.label}</span>
      </div>
      <div class="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
        <div>${fileSizeLabel}: ${size}</div>
        <div>${paperLabel}: ${job.settings?.pageSize || 'A4'} · ${marginLabel}: ${job.settings?.marginMm ?? 15}mm</div>
      </div>
      ${job.error ? `<div class="text-sm text-rose-300">${t('statusFailed')}: ${escapeHtml(job.error)}</div>` : ''}
      <div class="flex flex-wrap gap-3">
        ${actions.join('') || `<span class="text-sm text-slate-500">${t('noActions')}</span>`}
      </div>
    </article>
  `;
}

function statusInfo(status) {
  switch (status) {
    case 'queued':
      return { label: t('statusQueued'), badge: 'bg-slate-800/80 text-cyan-300 border border-cyan-500/20' };
    case 'processing':
      return { label: t('statusProcessing'), badge: 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 animate-pulse' };
    case 'completed':
      return { label: t('statusCompleted'), badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' };
    case 'failed':
      return { label: t('statusFailed'), badge: 'bg-rose-500/20 text-rose-200 border border-rose-500/30' };
    case 'canceled':
      return { label: t('statusCanceled'), badge: 'bg-amber-500/20 text-amber-200 border border-amber-500/30' };
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
  if (!Number(bytes)) return t('sizeUnknown');
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
  if (!files || !files.length) return;
  const queue = Array.from(files);

  state.uploading = true;
  showToast(t('toastUploadPending'), 'info');
  const created = [];

  for (const file of queue) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pageSize', state.settings.pageSize);
    formData.append('margin', state.settings.marginMm);

    try {
      const res = await fetch('/api/jobs', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) {
        const message = (await res.text()) || t('toastUploadErrorPrefix');
        throw new Error(message);
      }
      const data = await res.json();
      created.push(data.job);
    } catch (error) {
      const networkError = error?.message?.includes('Failed to fetch');
      showToast(`${t('toastUploadErrorPrefix')}：${networkError ? t('toastServerUnavailable') : error.message}`, 'error');
    }
  }

  if (created.length) {
    created.forEach((job) => state.jobs.unshift(job));
    renderJobs();
    showToast(`${t('toastUploadSuccess')} ×${created.length}`, 'success');
  }

  state.uploading = false;
  fileInput.value = '';
  refreshJobs();
}

async function handleJobAction(action, id) {
  if (!id) return;
  try {
    if (action === 'retry') {
      const res = await fetch(`/api/jobs/${id}/retry`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      showToast(t('toastOperationSuccess'), 'success');
      await refreshJobs();
    } else if (action === 'delete' || action === 'cancel') {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      showToast(data.message || t('toastOperationSuccess'), 'success');
      await refreshJobs();
    } else if (action === 'reveal') {
      const res = await fetch(`/api/jobs/${id}/reveal`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      showToast(t('toastRevealSuccess'), 'success');
    }
  } catch (error) {
    showToast(`${t('toastOperationFailed')}：${error?.message || ''}`, 'error');
  }
}

async function handleClearJobs() {
  if (!confirm(t('confirmClear'))) return;
  const res = await fetch('/api/jobs', { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    showToast(t('toastOperationFailed'), 'error');
    return;
  }
  showToast(t('toastClearSuccess'), 'success');
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
    credentials: 'include',
  });
  if (res.ok) {
    const data = await res.json();
    state.user.displayName = data.displayName;
    displayNameEl.textContent = data.displayName || t('currentUserLabel');
    showToast(t('toastSettingsSaved'), 'success');
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

function toggleLocale() {
  state.locale = state.locale === 'en' ? 'zh' : 'en';
  localStorage.setItem('epub:locale', state.locale);
  applyTranslations();
  renderJobs();
  showToast(t('toastLanguageChanged'), 'info');
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
localeToggle.addEventListener('click', toggleLocale);

init().catch((error) => {
  console.error(error);
  showToast(t('toastServerUnavailable'), 'error');
});
