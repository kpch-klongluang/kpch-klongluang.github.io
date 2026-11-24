const API_URL = 'https://script.google.com/macros/s/AKfycbwuuQeFT7Ikjcr4GeTrwdY_7I4hJ-Ksgs4dWWYV1us8lOe02233vtOgv0TTyPwgM9Vu/exec';
const SCHOOL_NAME_TH = 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง';
const GARUDA_URL = 'garuda.png';

let PUBLIC_CATEGORIES = [];
let PUBLIC_TEACHERS = [];
let CURRENT_USER = null;
let CURRENT_TOKEN = localStorage.getItem('kpch_token') || '';
let DASHBOARD_DATA = {
  submissions: [],
  requests12: [],
  users: [],
  categories: [],
  logs: [],
  trash12: [],
  trashSubs: [],
  maintenance: null,
  doc_templates_admin: null,
  announcement: null
};
let CURRENT_STATUS_DATA = { approvals12: [], submissions: [] };
let ACTIVE_PUBLIC_TAB = 'pre12';
let ACTIVE_TEACHER_TAB = 'subs';
let ACTIVE_ADMIN_TAB = 'subs';
let SELECTED_SUBMIT_IMAGES = [];
let SELECTED_STUDENT_EDIT_IMAGES = [];
let DOC56_ITEMS = [];
let DOC57_ITEMS = [];
let DOC_TEMPLATES_READY = { memo56: false, memo46: false };
let MAINT_POLL_TIMER = null;
const SIGNATURE_PADS = {};

// ==================== API & Normalizers ====================
function showLoading(show, msg = 'กำลังดำเนินการ...') {
  const el = document.getElementById('loadingOverlay');
  const txt = document.getElementById('loadingText');
  if (txt) txt.textContent = msg;
  if (el) el.style.display = show ? 'flex' : 'none';
}

async function callApi(action, body = {}, showLoader = true, loaderMsg = 'กำลังดำเนินการ...') {
  if (showLoader) showLoading(true, loaderMsg);
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body })
    });
    const raw = await resp.json();

    if (raw && 'ok' in raw) {
      if (!raw.ok) {
        const msg = raw.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
        const maintBlocked = /ปรับปรุง/.test(msg);
        const authErr = /Session|เข้าสู่ระบบใหม่/.test(msg);
        if (raw.maintenance) applyMaintenanceState(raw.maintenance);
        return { success: false, message: msg, maintenance_blocked: maintBlocked, auth_error: authErr };
      }
      const d = raw.data;
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        return { success: true, ...d };
      }
      return { success: true, data: d };
    }

    if (raw && raw.maintenance_blocked) {
      applyMaintenanceState(raw.maintenance);
    }
    return raw;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง' };
  } finally {
    if (showLoader) showLoading(false);
  }
}

function norm12(r) {
  if (!r) return r;
  return {
    ...r,
    id: r.req12_id || r.id || '',
    status: r.status_12 || r.status || 'WAIT_TEACHER_12',
    start_date: r.plan_start_date || r.start_date || '',
    end_date: r.plan_end_date || r.end_date || '',
    teacher_comment: r.reject_reason_12 || r.teacher_comment || ''
  };
}

function normSub(r) {
  if (!r) return r;
  const imgs = Array.isArray(r.images) && r.images.length
    ? r.images
    : [r.img_1, r.img_2, r.img_3, r.img_4].filter(Boolean);
  return {
    ...r,
    id: r.req_id || r.id || '',
    status: r.current_step || r.status || 'WAIT_TEACHER',
    start_date: r.activity_date || r.start_date || '',
    end_date: r.activity_end_date || r.end_date || '',
    detail: r.activity_detail || r.detail || '',
    term_year: r.term || r.term_year || '',
    teacher_comment: r.reject_reason || r.teacher_comment || '',
    images: imgs
  };
}

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toThaiDigits(str) {
  const th = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return String(str == null ? '' : str).replace(/\d/g, d => th[Number(d)]);
}

function formatThaiDate(val) {
  if (!val) return '-';
  const s = String(val).trim();
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]) + 543;
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    if (months[mo]) return `${d} ${months[mo]} ${y}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
  }
  return s;
}

function formatDateRangeThai(s, e) {
  if (!s && !e) return '-';
  const fs = formatThaiDate(s);
  const fe = formatThaiDate(e);
  return fs === fe || !e ? fs : `${fs} ถึง ${fe}`;
}

function formatDateInput(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return '';
}

function getDriveDirectImgUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('data:image/')) return s;
  let id = '';
  const m1 = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) id = m1[1];
  else {
    const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) id = m2[1];
  }
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w1000`;
  return s;
}

function statusBadge12(st) {
  const map = {
    WAIT_TEACHER_12: '<span class="badge bg-warning text-dark">รอครูที่ปรึกษาอนุมัติ</span>',
    PENDING_TEACHER: '<span class="badge bg-warning text-dark">รอครูที่ปรึกษาอนุมัติ</span>',
    APPROVED_12: '<span class="badge bg-success">อนุมัติแล้ว (ทำกิจกรรมได้)</span>',
    APPROVED: '<span class="badge bg-success">อนุมัติแล้ว (ทำกิจกรรมได้)</span>',
    REJECTED_12: '<span class="badge bg-danger">ไม่อนุมัติ / ส่งแก้ไข</span>',
    REJECTED: '<span class="badge bg-danger">ไม่อนุมัติ / ส่งแก้ไข</span>'
  };
  return map[st] || `<span class="badge bg-secondary">${escHtml(st)}</span>`;
}

function statusBadgeSub(st) {
  const map = {
    WAIT_TEACHER: '<span class="badge bg-warning text-dark">รอครูตรวจหลักฐาน</span>',
    PENDING_TEACHER: '<span class="badge bg-warning text-dark">รอครูตรวจหลักฐาน</span>',
    APPROVED_FOR_REGISTRAR: '<span class="badge bg-primary">ครูอนุมัติแล้ว / รอทะเบียน</span>',
    PENDING_REGISTRAR: '<span class="badge bg-primary">ครูอนุมัติแล้ว / รอทะเบียน</span>',
    COMPLETED: '<span class="badge bg-success">บันทึกชั่วโมงแล้ว</span>',
    REJECTED: '<span class="badge bg-danger">ไม่ผ่าน / ส่งแก้ไข</span>'
  };
  return map[st] || `<span class="badge bg-secondary">${escHtml(st)}</span>`;
}

function resizeImageToObj(file, maxW = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปไม่ถูกต้อง'));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          dataUrl,
          base64Data: dataUrl.split(',')[1] || '',
          mimeType: 'image/jpeg'
        });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImagesSelect(input, previewId, mode) {
  const files = Array.from(input.files || []).slice(0, 3);
  if ((input.files || []).length > 3) {
    Swal.fire('แจ้งเตือน', 'แนบภาพถ่ายได้สูงสุด 3 รูปต่อรายการ (ระบบจะเลือก 3 รูปแรก)', 'info');
  }
  const list = [];
  for (const f of files) {
    try {
      const obj = await resizeImageToObj(f, 960, 0.72);
      list.push(obj);
    } catch (_) {}
  }
  if (mode === 'submit') SELECTED_SUBMIT_IMAGES = list;
  else if (mode === 'studentEdit') SELECTED_STUDENT_EDIT_IMAGES = list;

  const box = document.getElementById(previewId);
  if (box) {
    box.innerHTML = list.map(o => `<img src="${o.dataUrl}" class="thumb-preview" alt="preview">`).join('');
  }
}

// ==================== Word MHTML & Print Helpers ====================
async function fetchImageAsBase64(url) {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    const m = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (m) return { mime: m[1], base64: m[2] };
  }
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(resolve => {
      const fr = new FileReader();
      fr.onloadend = () => {
        const str = String(fr.result || '');
        const m = str.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        resolve(m ? { mime: m[1], base64: m[2] } : null);
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

async function downloadWordMhtml(filename, htmlBody, imgList = []) {
  showLoading(true, 'กำลังสร้างไฟล์ Word (.doc)...');
  try {
    const boundary = '----=_NextPart_KPCH_001';
    const parts = [];
    for (let i = 0; i < imgList.length; i++) {
      const item = imgList[i];
      if (!item || !item.url || !item.cid) continue;
      const b64 = await fetchImageAsBase64(item.url);
      if (b64) {
        parts.push(
          `--${boundary}\r\n` +
          `Content-Location: file:///C:/kpch_assets/${item.cid}\r\n` +
          `Content-Transfer-Encoding: base64\r\n` +
          `Content-Type: ${b64.mime}\r\n\r\n` +
          `${b64.base64.replace(/(.{76})/g, '$1\r\n')}\r\n\r\n`
        );
      }
    }

    const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 1.5cm 1.5cm 1.5cm 1.8cm; }
  body { font-family: 'TH SarabunPSK', 'TH Sarabun New', 'Prompt', sans-serif; font-size: 16pt; color: #000; line-height: 1.25; }
  table { border-collapse: collapse; width: 100%; }
  .doc-page { page-break-after: always; }
  .doc-page:last-child { page-break-after: auto; }
</style>
</head>
<body>${htmlBody}</body></html>`;

    const mhtml =
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset="utf-8"\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n\r\n` +
      `${fullHtml}\r\n\r\n` +
      parts.join('') +
      `--${boundary}--`;

    const blob = new Blob(['\ufeff', mhtml], { type: 'application/msword;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  } finally {
    showLoading(false);
  }
}

function printHtmlDocument(htmlContent) {
  const container = document.getElementById('printOnlyContainer');
  if (!container) return;
  container.innerHTML = htmlContent;
  const imgs = Array.from(container.querySelectorAll('img'));
  const waits = imgs.map(img => new Promise(resolve => {
    if (img.complete) return resolve();
    img.onload = resolve;
    img.onerror = resolve;
    setTimeout(resolve, 2500);
  }));
  Promise.all(waits).then(() => {
    setTimeout(() => window.print(), 180);
  });
}

// ==================== Maintenance Sync & Google Docs Helpers ====================
function applyMaintenanceState(m) {
  if (!m) return;
  const enabled = !!m.enabled;
  const isAdmin = CURRENT_USER && CURRENT_USER.role === 'ADMIN';

  const overlay = document.getElementById('maintenanceOverlay');
  if (overlay) {
    if (enabled && !isAdmin) {
      document.getElementById('maintOverlayTitle').textContent = m.title || 'ระบบอยู่ระหว่างการปรับปรุงชั่วคราว';
      document.getElementById('maintOverlayMessage').textContent = m.message || 'ขออภัยในความไม่สะดวก กรุณากลับมาใช้งานใหม่ภายหลัง';
      document.getElementById('maintOverlayEta').textContent = m.eta || 'เร็วๆ นี้';
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }

  const banner = document.getElementById('adminMaintenanceBanner');
  if (banner) {
    const showBanner = enabled && isAdmin;
    banner.classList.toggle('d-none', !showBanner);
    banner.classList.toggle('d-flex', showBanner);
  }

  const sbDot = document.getElementById('sbMaintDot');
  const mbDot = document.getElementById('mbMaintDot');
  if (sbDot) sbDot.style.display = enabled ? 'inline-block' : 'none';
  if (mbDot) mbDot.style.display = enabled ? 'inline-block' : 'none';
}

async function checkSystemStatusNow(manual = false) {
  const res = await callApi('getSystemStatus', { token: CURRENT_TOKEN }, manual, 'กำลังตรวจสอบสถานะระบบ...');
  if (res && res.success) {
    applyMaintenanceState(res.maintenance);
    if (manual && (!res.maintenance || !res.maintenance.enabled)) {
      Swal.fire('ระบบเปิดให้บริการแล้ว', 'กำลังรีเฟรชข้อมูลล่าสุด', 'success');
      loadPublicData();
    }
  }
}

function startMaintenanceSync() {
  if (MAINT_POLL_TIMER) clearInterval(MAINT_POLL_TIMER);
  MAINT_POLL_TIMER = setInterval(() => {
    if (document.visibilityState === 'visible') checkSystemStatusNow(false);
  }, 12000);
  window.addEventListener('focus', () => checkSystemStatusNow(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSystemStatusNow(false);
  });
}

function copyTemplateTag(tag) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tag);
  }
  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `คัดลอก ${tag} แล้ว`, showConfirmButton: false, timer: 1400 });
}

async function generateDocFromTemplateUI(docKind, outputFormat) {
  const is56 = docKind === 'memo56';
  const p = is56 ? 'd56' : 'd57';
  const fields = {
    DOC_NO: document.getElementById(`${p}_doc_no`).value.trim(),
    DOC_DATE: document.getElementById(`${p}_doc_date`).value.trim(),
    PROJECT_NAME: document.getElementById(`${p}_project_name`).value.trim(),
    STUDENT_COUNT: document.getElementById(`${p}_student_count`).value.trim(),
    HOURS: is56 ? '' : document.getElementById('d57_hours').value.trim(),
    START_DATE: document.getElementById(`${p}_start_date`).value.trim(),
    END_DATE: document.getElementById(`${p}_end_date`).value.trim(),
    LOCATION: document.getElementById(`${p}_location`).value.trim(),
    ADVISOR_NAME: document.getElementById(`${p}_advisor_name`).value.trim(),
    STUDENT_LIST: document.getElementById(`${p}_student_list`).value.trim()
  };

  const res = await callApi('generateFromGoogleDocTemplate', {
    token: CURRENT_TOKEN,
    doc_kind: docKind,
    fields,
    output_format: outputFormat
  }, true, 'กำลังสร้างเอกสารจาก Google Docs...');

  if (!res.success) {
    return Swal.fire('ไม่สำเร็จ', res.message || 'ไม่สามารถสร้างเอกสารได้', 'error');
  }

  if (outputFormat === 'gdoc' && res.doc_url) {
    Swal.fire({
      icon: 'success',
      title: 'สร้างเอกสาร Google Docs สำเร็จ',
      html: `<p class="small text-muted mb-3">เอกสารถูกสร้างจากแบบฟอร์มของคุณเรียบร้อยแล้ว กดปุ่มด้านล่างเพื่อเปิดเอกสาร</p>
             <a href="${escHtml(res.doc_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary rounded-3 px-4">
               <i class="bi bi-box-arrow-up-right me-1"></i>เปิดไฟล์ใน Google Docs
             </a>`,
      showConfirmButton: true,
      confirmButtonText: 'ปิดหน้าต่าง'
    });
  } else if (res.base64 && res.filename) {
    const bin = atob(res.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: res.mimeType || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }
}

// ==================== Signature Pad Engine ====================
function updateSigPadStatus(canvasId) {
  const pad = SIGNATURE_PADS[canvasId];
  const statusId = canvasId === 'p12_sig_canvas' ? 'p12_sig_status' : 'se_sig_status';
  const el = document.getElementById(statusId);
  if (!el) return;
  if (pad && pad.hasData) {
    el.innerHTML = '<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>มีลายเซ็นพร้อมใช้งานแล้ว</span>';
  } else {
    el.innerHTML = '<span class="text-muted">ยังไม่ได้ลงลายเซ็น</span>';
  }
}

function initSignaturePad(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (SIGNATURE_PADS[canvasId] && SIGNATURE_PADS[canvasId].initialized) return;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width || 400, 300);
  const h = 140;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#0f172a';

  const state = {
    canvas,
    ctx,
    dpr,
    width: w,
    height: h,
    drawing: false,
    hasData: false,
    initialized: true
  };
  SIGNATURE_PADS[canvasId] = state;

  const getPos = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * state.width) / (r.width || state.width),
      y: ((e.clientY - r.top) * state.height) / (r.height || state.height)
    };
  };

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = getPos(e);
    state.drawing = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    state.hasData = true;
    updateSigPadStatus(canvasId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!state.drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  const stopDraw = () => {
    if (!state.drawing) return;
    state.drawing = false;
    ctx.closePath();
  };
  canvas.addEventListener('pointerup', stopDraw);
  canvas.addEventListener('pointercancel', stopDraw);
}

function clearSignaturePad(canvasId) {
  const state = SIGNATURE_PADS[canvasId];
  if (!state) return;
  state.ctx.save();
  state.ctx.setTransform(1, 0, 0, 1, 0, 0);
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  state.ctx.restore();
  state.hasData = false;
  const upId = canvasId === 'p12_sig_canvas' ? 'p12_sig_upload' : 'se_sig_upload';
  const up = document.getElementById(upId);
  if (up) up.value = '';
  updateSigPadStatus(canvasId);
}

function loadSignatureToPad(canvasId, dataUrl) {
  initSignaturePad(canvasId);
  clearSignaturePad(canvasId);
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return;
  const state = SIGNATURE_PADS[canvasId];
  if (!state) return;
  const img = new Image();
  img.onload = () => {
    const padRatio = Math.min((state.width - 24) / img.width, (state.height - 20) / img.height);
    const dw = img.width * padRatio;
    const dh = img.height * padRatio;
    state.ctx.drawImage(img, (state.width - dw) / 2, (state.height - dh) / 2, dw, dh);
    state.hasData = true;
    updateSigPadStatus(canvasId);
  };
  img.src = dataUrl;
}

function handleSignatureImageUpload(input, canvasId) {
  const file = input.files && input.files[0];
  if (!file) return;
  initSignaturePad(canvasId);
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement('canvas');
      const maxDim = 420;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      tmp.width = Math.max(1, Math.round(img.width * scale));
      tmp.height = Math.max(1, Math.round(img.height * scale));
      const tctx = tmp.getContext('2d');
      tctx.drawImage(img, 0, 0, tmp.width, tmp.height);

      const imgData = tctx.getImageData(0, 0, tmp.width, tmp.height);
      const px = imgData.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] > 210 && px[i + 1] > 210 && px[i + 2] > 210) {
          px[i + 3] = 0;
        }
      }
      tctx.putImageData(imgData, 0, 0);

      clearSignaturePad(canvasId);
      const state = SIGNATURE_PADS[canvasId];
      if (!state) return;
      const fit = Math.min((state.width - 20) / tmp.width, (state.height - 16) / tmp.height);
      const dw = tmp.width * fit;
      const dh = tmp.height * fit;
      state.ctx.drawImage(tmp, (state.width - dw) / 2, (state.height - dh) / 2, dw, dh);
      state.hasData = true;
      updateSigPadStatus(canvasId);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function exportSignatureDataUrl(canvasId) {
  const state = SIGNATURE_PADS[canvasId];
  if (!state || !state.hasData) return '';
  const { canvas } = state;
  const w = canvas.width;
  const h = canvas.height;
  const rawCtx = canvas.getContext('2d');
  const data = rawCtx.getImageData(0, 0, w, h).data;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return '';

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  const targetW = Math.min(cw, 360);
  const targetH = Math.max(1, Math.round((ch * targetW) / cw));
  out.width = targetW;
  out.height = targetH;
  out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, targetW, targetH);

  let pngUrl = out.toDataURL('image/png');
  if (pngUrl.length > 42000) {
    const sm = document.createElement('canvas');
    sm.width = Math.round(targetW * 0.7);
    sm.height = Math.round(targetH * 0.7);
    sm.getContext('2d').drawImage(out, 0, 0, sm.width, sm.height);
    pngUrl = sm.toDataURL('image/png');
  }
  return pngUrl;
}

function renderStudentSigHtml(sigDataUrl, heightPx = 38, wordCid = '') {
  if (!sigDataUrl || !String(sigDataUrl).startsWith('data:image/')) return '';
  const src = wordCid ? `cid:${wordCid}` : sigDataUrl;
  return `<div style="line-height:1; margin: 2px 0 -4px 0;"><img src="${src}" alt="ลายเซ็นนักศึกษา" style="height:${heightPx}px; max-width:165px; object-fit:contain; display:inline-block;"></div>`;
}
// ==================== Navigation & Public Data ====================
function extractAnnouncementText(ann) {
  if (!ann) return '';
  if (typeof ann === 'string') return ann.trim();
  if (typeof ann === 'object') {
    if (ann.visible === false) return '';
    return String(ann.content || '').trim();
  }
  return '';
}

function renderNavbar() {
  const isStaff = !!CURRENT_USER;
  const role = CURRENT_USER ? CURRENT_USER.role : 'PUBLIC';

  document.getElementById('sidebarPublicNav').style.display = isStaff ? 'none' : 'block';
  document.getElementById('sidebarTeacherNav').style.display = role === 'TEACHER' ? 'block' : 'none';
  document.getElementById('sidebarRegistrarNav').style.display = role === 'REGISTRAR' ? 'block' : 'none';
  document.getElementById('sidebarAdminNav').style.display = role === 'ADMIN' ? 'block' : 'none';

  document.getElementById('sbGuestBox').style.display = isStaff ? 'none' : 'block';
  document.getElementById('sbUserBox').style.display = isStaff ? 'block' : 'none';

  document.getElementById('mobilePublicBottomNav').style.display = isStaff ? 'none' : 'flex';
  document.getElementById('teacherMobileTabs').style.display = role === 'TEACHER' ? 'grid' : 'none';
  document.getElementById('adminMobileTabs').style.display = role === 'ADMIN' ? 'grid' : 'none';

  const mobileArea = document.getElementById('mobileUserArea');
  const topRight = document.getElementById('desktopTopRight');

  if (isStaff) {
    document.getElementById('sbUserName').textContent = CURRENT_USER.full_name || CURRENT_USER.username;
    const roleLabel = role === 'ADMIN' ? 'ผู้ดูแลระบบ (ADMIN)' : (role === 'REGISTRAR' ? 'งานทะเบียน' : 'ครูที่ปรึกษา');
    document.getElementById('sbUserRole').textContent = roleLabel;
    if (mobileArea) {
      mobileArea.innerHTML = `<button class="btn btn-light btn-sm rounded-3 py-1 px-2" onclick="logout()"><i class="bi bi-box-arrow-right me-1"></i>ออก</button>`;
    }
    if (topRight) {
      topRight.innerHTML = `<span class="badge bg-indigo-soft px-3 py-2 rounded-3"><i class="bi bi-person-check me-1"></i>${escHtml(CURRENT_USER.full_name)}</span>`;
    }
  } else {
    if (mobileArea) {
      mobileArea.innerHTML = `<button class="btn btn-light btn-sm rounded-3 py-1 px-2" onclick="openLoginModal()"><i class="bi bi-shield-lock me-1"></i>เจ้าหน้าที่</button>`;
    }
    if (topRight) {
      topRight.innerHTML = `<button class="btn btn-outline-primary btn-sm rounded-3" onclick="switchPublicTab('status')"><i class="bi bi-search me-1"></i>เช็คสถานะนักศึกษา</button>`;
    }
  }
}

function switchPublicTab(tab) {
  ACTIVE_PUBLIC_TAB = tab;
  document.getElementById('publicPre12View').style.display = tab === 'pre12' ? 'block' : 'none';
  document.getElementById('publicSubmitView').style.display = tab === 'submit' ? 'block' : 'none';
  document.getElementById('publicStatusView').style.display = tab === 'status' ? 'block' : 'none';

  const mapSb = { pre12: 'sbBtnPre12', submit: 'sbBtnSubmit', status: 'sbBtnStatus' };
  const mapMb = { pre12: 'mbBtnPre12', submit: 'mbBtnSubmit', status: 'mbBtnStatus' };
  Object.keys(mapSb).forEach(k => {
    const sb = document.getElementById(mapSb[k]);
    const mb = document.getElementById(mapMb[k]);
    if (sb) sb.classList.toggle('active', k === tab);
    if (mb) mb.classList.toggle('active', k === tab);
  });

  const titles = {
    pre12: ['ยื่นขออนุมัติทำกิจกรรม (กพช. 1-2)', 'กรอกข้อมูลล่วงหน้าและลงลายเซ็นก่อนเริ่มทำกิจกรรมพัฒนาคุณภาพชีวิต'],
    submit: ['ส่งหลักฐานผลการทำกิจกรรม (กพช. 4)', 'ตรวจสอบสิทธิ์จาก กพช. 1-2 และแนบภาพถ่ายผลการปฏิบัติกิจกรรม'],
    status: ['ตรวจสอบสถานะ / แก้ไขข้อมูล', 'ค้นหาด้วยรหัสนักศึกษา ชื่อ-นามสกุล หรือเลขที่คำขอ พร้อมพิมพ์เอกสาร']
  };
  document.getElementById('desktopPageTitle').textContent = titles[tab][0];
  document.getElementById('desktopPageSubtitle').textContent = titles[tab][1];

  if (tab === 'pre12') {
    setTimeout(() => initSignaturePad('p12_sig_canvas'), 40);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function populateSelectOptions() {
  const teacherIds = ['p12_teacher_id', 'f_teacher_id', 'se_teacher_id'];
  teacherIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const oldVal = sel.value;
    sel.innerHTML = '<option value="">-- เลือกครูที่ปรึกษา --</option>' +
      PUBLIC_TEACHERS.map(t => `<option value="${escHtml(t.user_id)}">${escHtml(t.full_name)}${t.group_name ? ` (${escHtml(t.group_name)})` : ''}</option>`).join('');
    if (oldVal) sel.value = oldVal;
  });

  const catIds = ['p12_category', 'f_category', 'se_category'];
  catIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const oldVal = sel.value;
    sel.innerHTML = '<option value="">-- เลือกประเภทกิจกรรม --</option>' +
      PUBLIC_CATEGORIES.map(c => {
        const cname = c.cat_name || c.name || '';
        return `<option value="${escHtml(cname)}">${escHtml(cname)}</option>`;
      }).join('');
    if (oldVal) sel.value = oldVal;
  });
}

async function loadPublicData() {
  const res = await callApi('getPublicData', {}, false);
  if (!res || !res.success) return;
  PUBLIC_TEACHERS = res.teachers || [];
  PUBLIC_CATEGORIES = (res.categories || []).filter(c => (c.status ? c.status === 'ACTIVE' : c.is_active !== false));
  DOC_TEMPLATES_READY = res.doc_templates || { memo56: false, memo46: false };
  populateSelectOptions();

  const ann = extractAnnouncementText(res.announcement);
  const box = document.getElementById('annPublicBox');
  const txt = document.getElementById('annPublicText');
  if (box && txt) {
    txt.textContent = ann;
    box.style.display = ann ? 'block' : 'none';
  }
  if (res.maintenance) applyMaintenanceState(res.maintenance);
}

// ==================== Public Form Submissions ====================
async function handlePre12Submit(e) {
  e.preventDefault();
  const sid = document.getElementById('p12_student_id').value.trim();
  if (!/^6\d{9}$/.test(sid)) {
    return Swal.fire('รหัสนักศึกษาไม่ถูกต้อง', 'กรุณากรอกรหัสนักศึกษา 10 หลัก (ขึ้นต้นด้วยเลข 6)', 'warning');
  }
  const sd = document.getElementById('p12_start_date').value;
  const ed = document.getElementById('p12_end_date').value;
  if (sd && ed && sd > ed) {
    return Swal.fire('วันที่ไม่ถูกต้อง', 'วันที่เริ่มกิจกรรมต้องไม่เกินวันที่สิ้นสุด', 'warning');
  }
  const sigDataUrl = exportSignatureDataUrl('p12_sig_canvas');
  if (!sigDataUrl) {
    return Swal.fire('กรุณาลงลายเซ็น', 'กรุณาเซ็นชื่อในกรอบลายเซ็นหรืออัปโหลดรูปลายเซ็นก่อนยื่นคำขอ', 'warning');
  }

  const payload = {
    student_id: sid,
    student_name: document.getElementById('p12_student_name').value.trim(),
    level: document.getElementById('p12_level').value,
    teacher_id: document.getElementById('p12_teacher_id').value,
    group_name: document.getElementById('p12_group_name').value.trim(),
    term: '2/2569',
    category: document.getElementById('p12_category').value,
    activity_name: document.getElementById('p12_activity_name').value.trim(),
    hours: Number(document.getElementById('p12_hours').value || 0),
    role_note: document.getElementById('p12_role_note').value.trim() || 'ผู้เรียน',
    plan_start_date: sd,
    plan_end_date: ed,
    start_date: sd,
    end_date: ed,
    location: document.getElementById('p12_location').value.trim(),
    plan_detail: document.getElementById('p12_plan_detail').value.trim(),
    expected_outcome: document.getElementById('p12_expected_outcome').value.trim(),
    self_eval_ok: true,
    eval_scores: [],
    student_signature: sigDataUrl
  };

  const res = await callApi('submitPreApproval12', { payload }, true, 'กำลังบันทึกคำขอ กพช. 1-2...');
  if (!res.success) {
    return Swal.fire('ยื่นคำขอไม่สำเร็จ', res.message || 'เกิดข้อผิดพลาด', 'error');
  }

  const newId = res.req12_id || res.id || '-';
  document.getElementById('pre12Form').reset();
  clearSignaturePad('p12_sig_canvas');
  Swal.fire({
    icon: 'success',
    title: 'ยื่นคำขอ กพช. 1-2 สำเร็จ!',
    html: `<p class="mb-2">เลขที่คำขอของคุณคือ <strong class="text-primary">${escHtml(newId)}</strong></p>
           <p class="small text-muted mb-0">กรุณารอครูที่ปรึกษาอนุมัติก่อนเริ่มปฏิบัติกิจกรรม</p>`
  });
}

async function checkEligibilityUI() {
  const sid = document.getElementById('f_student_id').value.trim();
  if (!/^6\d{9}$/.test(sid)) {
    return Swal.fire('รหัสนักศึกษาไม่ถูกต้อง', 'กรุณากรอกรหัสนักศึกษา 10 หลัก (ขึ้นต้นด้วยเลข 6)', 'warning');
  }
  const res = await callApi('checkEligibility', { student_id: sid }, true, 'กำลังตรวจสอบสิทธิ์...');
  const box = document.getElementById('eligibilityResultBox');
  const bodyFs = document.getElementById('submitFormBody');

  const rawApproved = res.availableApproved12 || res.approved_12 || [];
  const approvedList = rawApproved.map(norm12);

  if (!res.success || !approvedList.length) {
    bodyFs.disabled = true;
    box.style.display = 'block';
    const anyList = (res.approvals12 || []).map(norm12);
    const waitMsg = anyList.length
      ? `พบคำขอ (${escHtml(anyList[0].id)}) แต่ยังรอครูที่ปรึกษาอนุมัติ`
      : 'ยังไม่พบคำขอ กพช. 1-2 ที่ได้รับอนุมัติ กรุณายื่น กพช. 1-2 ก่อน';
    box.innerHTML = `<div class="alert alert-warning mb-0 small rounded-3">
      <i class="bi bi-exclamation-circle me-1"></i>${escHtml(res.message || waitMsg)}
    </div>`;
    return;
  }

  const latest = approvedList[0];
  bodyFs.disabled = false;
  box.style.display = 'block';
  box.innerHTML = `<div class="alert alert-success mb-0 small rounded-3">
    <i class="bi bi-check-circle-fill me-1"></i>ผ่านการอนุมัติ กพช. 1-2 แล้ว (${escHtml(latest.id)}) : <strong>${escHtml(latest.activity_name)}</strong>
  </div>`;

  document.getElementById('f_ref_12_id').value = latest.id || '';
  document.getElementById('f_student_name').value = latest.student_name || '';
  document.getElementById('f_level').value = latest.level || '';
  document.getElementById('f_teacher_id').value = latest.teacher_id || '';
  document.getElementById('f_group_name').value = latest.group_name || '';
  document.getElementById('f_category').value = latest.category || '';
  document.getElementById('f_activity_name').value = latest.activity_name || '';
  document.getElementById('f_hours').value = latest.hours || '';
  document.getElementById('f_start_date').value = formatDateInput(latest.start_date);
  document.getElementById('f_end_date').value = formatDateInput(latest.end_date);
  document.getElementById('f_location').value = latest.location || '';
}

async function handleSubmitKPCH(e) {
  e.preventDefault();
  const sid = document.getElementById('f_student_id').value.trim();
  if (!/^6\d{9}$/.test(sid)) {
    return Swal.fire('รหัสนักศึกษาไม่ถูกต้อง', 'กรุณากรอกรหัสนักศึกษา 10 หลัก', 'warning');
  }
  if (SELECTED_SUBMIT_IMAGES.length < 2) {
    return Swal.fire('กรุณาแนบภาพถ่าย', 'กรุณาแนบภาพถ่ายขณะทำกิจกรรม 2 - 3 รูป', 'warning');
  }

  const sd = document.getElementById('f_start_date').value;
  const ed = document.getElementById('f_end_date').value;
  const detailTxt = document.getElementById('f_detail').value.trim();

  const payload = {
    student_id: sid,
    ref_12_id: document.getElementById('f_ref_12_id').value,
    student_name: document.getElementById('f_student_name').value.trim(),
    level: document.getElementById('f_level').value,
    teacher_id: document.getElementById('f_teacher_id').value,
    group_name: document.getElementById('f_group_name').value.trim(),
    category: document.getElementById('f_category').value,
    activity_name: document.getElementById('f_activity_name').value.trim(),
    hours: Number(document.getElementById('f_hours').value || 0),
    activity_date: sd,
    activity_end_date: ed,
    start_date: sd,
    end_date: ed,
    location: document.getElementById('f_location').value.trim(),
    k4_plan: document.getElementById('f_k4_plan').value.trim(),
    activity_detail: detailTxt,
    detail: detailTxt,
    k4_learning: document.getElementById('f_k4_learning').value.trim(),
    k4_problem: document.getElementById('f_k4_problem').value.trim(),
    k4_apply: document.getElementById('f_k4_apply').value.trim(),
    images: SELECTED_SUBMIT_IMAGES.map(x => ({ base64Data: x.base64Data, mimeType: x.mimeType }))
  };

  const res = await callApi('submitKPCH', { payload }, true, 'กำลังอัปโหลดภาพถ่ายและส่งหลักฐาน...');
  if (!res.success) {
    return Swal.fire('ส่งหลักฐานไม่สำเร็จ', res.message || 'เกิดข้อผิดพลาด', 'error');
  }

  const newId = res.req_id || res.id || '-';
  document.getElementById('submitForm').reset();
  document.getElementById('submitFormBody').disabled = true;
  document.getElementById('eligibilityResultBox').style.display = 'none';
  document.getElementById('imagePreviewBox').innerHTML = '';
  SELECTED_SUBMIT_IMAGES = [];

  Swal.fire({
    icon: 'success',
    title: 'ส่งหลักฐาน กพช. 4 สำเร็จ!',
    html: `<p class="mb-1">รหัสรายการ: <strong class="text-primary">${escHtml(newId)}</strong></p>
           <p class="small text-muted mb-0">สามารถติดตามสถานะได้ที่เมนู "เช็คสถานะ / แก้ไขข้อมูล"</p>`
  });
}

// ==================== Student Status Search & Self-Edit ====================
async function searchMyStatus() {
  const q = document.getElementById('searchStudentId').value.trim();
  if (q.length < 3) {
    return Swal.fire('คำค้นสั้นเกินไป', 'กรุณากรอกรหัสนักศึกษา, ชื่อ-นามสกุล (อย่างน้อย 3 ตัวอักษร) หรือเลขที่คำขอ', 'warning');
  }
  const res = await callApi('checkStatus', { student_id: q }, true, 'กำลังค้นหาข้อมูล...');
  const area = document.getElementById('statusResultArea');
  if (!res.success) {
    area.innerHTML = `<div class="alert alert-danger rounded-4">${escHtml(res.message || 'ค้นหาไม่สำเร็จ')}</div>`;
    return;
  }

  const list12 = (res.approvals12 || []).map(norm12);
  const listSubs = (res.submissions || []).map(normSub);
  CURRENT_STATUS_DATA = { approvals12: list12, submissions: listSubs };

  if (!list12.length && !listSubs.length) {
    area.innerHTML = `<div class="cute-card p-4 text-center text-muted">
      <i class="bi bi-inbox fs-2 d-block mb-2"></i>
      ไม่พบข้อมูลสำหรับ "<strong>${escHtml(q)}</strong>"
    </div>`;
    return;
  }

  let html = '';
  if (list12.length) {
    html += `<h6 class="fw-bold mb-2 text-primary"><i class="bi bi-file-earmark-text me-1"></i>คำขออนุมัติล่วงหน้า (กพช. 1-2) (${list12.length} รายการ)</h6>`;
    html += list12.map((it, idx) => {
      const canEdit = ['WAIT_TEACHER_12', 'REJECTED_12', 'PENDING_TEACHER', 'REJECTED'].includes(it.status);
      const hasSig = it.student_signature && String(it.student_signature).startsWith('data:image/');
      return `<div class="cute-card p-3 mb-3">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <span class="badge bg-light text-dark border me-1">${escHtml(it.id)}</span>
            ${statusBadge12(it.status)}
            ${hasSig ? '<span class="badge bg-info-subtle text-info-emphasis ms-1"><i class="bi bi-pen me-1"></i>มีลายเซ็น</span>' : ''}
          </div>
          <div class="small text-muted">${escHtml(it.student_id)} • ${escHtml(it.student_name)}</div>
        </div>
        <div class="fw-bold mb-1">${escHtml(it.activity_name)} <span class="badge bg-indigo-soft ms-1">${escHtml(it.hours)} ชม.</span></div>
        <div class="small text-muted mb-2">
          ประเภท: ${escHtml(it.category)} | วันที่: ${formatDateRangeThai(it.start_date, it.end_date)} | สถานที่: ${escHtml(it.location)}
        </div>
        ${it.teacher_comment ? `<div class="alert alert-light border py-2 px-3 small mb-2"><strong>ความเห็นครู:</strong> ${escHtml(it.teacher_comment)}</div>` : ''}
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="printMySelf12(${idx})">
            <i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word (กพช. 1-2)
          </button>
          ${canEdit ? `<button type="button" class="btn btn-warning btn-sm rounded-3" onclick="openStudentEditModal('12', ${idx})">
            <i class="bi bi-pencil-square me-1"></i>แก้ไขข้อมูล / รหัส นศ. / ลายเซ็น
          </button>` : `<span class="small text-muted align-self-center"><i class="bi bi-info-circle me-1"></i>หากต้องการแก้รหัส นศ. หลังอนุมัติ กรุณาแจ้งครูที่ปรึกษา</span>`}
        </div>
      </div>`;
    }).join('');
  }

  if (listSubs.length) {
    html += `<h6 class="fw-bold mt-4 mb-2 text-success"><i class="bi bi-journal-check me-1"></i>หลักฐานผลการทำกิจกรรม (กพช. 4) (${listSubs.length} รายการ)</h6>`;
    html += listSubs.map((it, idx) => {
      const canEdit = ['WAIT_TEACHER', 'REJECTED', 'PENDING_TEACHER'].includes(it.status);
      return `<div class="cute-card p-3 mb-3">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <span class="badge bg-light text-dark border me-1">${escHtml(it.id)}</span>
            ${statusBadgeSub(it.status)}
          </div>
          <div class="small text-muted">${escHtml(it.student_id)} • ${escHtml(it.student_name)}</div>
        </div>
        <div class="fw-bold mb-1">${escHtml(it.activity_name)} <span class="badge bg-success-subtle text-success-emphasis ms-1">${escHtml(it.hours)} ชม.</span></div>
        <div class="small text-muted mb-2">
          ประเภท: ${escHtml(it.category)} | ภาคเรียน: ${escHtml(it.term_year || '-')} | วันที่: ${formatDateRangeThai(it.start_date, it.end_date)}
        </div>
        ${it.teacher_comment ? `<div class="alert alert-light border py-2 px-3 small mb-2"><strong>ความเห็นครู:</strong> ${escHtml(it.teacher_comment)}</div>` : ''}
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-outline-success btn-sm rounded-3" onclick="printMySelf4(${idx})">
            <i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word (กพช. 4)
          </button>
          ${canEdit ? `<button type="button" class="btn btn-warning btn-sm rounded-3" onclick="openStudentEditModal('sub', ${idx})">
            <i class="bi bi-pencil-square me-1"></i>แก้ไขข้อมูล / รหัส นศ.
          </button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  area.innerHTML = html;
}

async function askPrintOrWordChoice(title) {
  const result = await Swal.fire({
    title: title || 'เลือกรูปแบบเอกสาร',
    text: 'ต้องการพิมพ์ PDF หรือดาวน์โหลดเป็นไฟล์ Word (.doc)',
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: '<i class="bi bi-printer me-1"></i> พิมพ์ / PDF (A4)',
    denyButtonText: '<i class="bi bi-file-earmark-word me-1"></i> โหลด Word (.doc)',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#4f46e5',
    denyButtonColor: '#0ea5e9'
  });
  if (result.isConfirmed) return 'print';
  if (result.isDenied) return 'word';
  return null;
}

async function printMySelf12(idx) {
  const item = CURRENT_STATUS_DATA.approvals12[idx];
  if (!item) return;
  const mode = await askPrintOrWordChoice('เอกสาร กพช. 1-2');
  if (!mode) return;
  if (mode === 'word') {
    const html = buildKPCH12Html([item], true);
    const imgs = [];
    if (item.student_signature) imgs.push({ cid: 'sig_stu_0', url: item.student_signature });
    await downloadWordMhtml(`KPCH12_${item.student_id}`, html, imgs);
  } else {
    printHtmlDocument(buildKPCH12Html([item], false));
  }
}

async function printMySelf4(idx) {
  const item = CURRENT_STATUS_DATA.submissions[idx];
  if (!item) return;
  const mode = await askPrintOrWordChoice('เอกสาร กพช. 4');
  if (!mode) return;
  if (mode === 'word') {
    const html = buildKPCH4Html(item, true, 0);
    const imgs = [];
    if (item.student_signature) imgs.push({ cid: 'sig_stu_0', url: item.student_signature });
    (item.images || []).slice(0, 4).forEach((u, i) => {
      imgs.push({ cid: `photo_0_${i}`, url: getDriveDirectImgUrl(u) });
    });
    await downloadWordMhtml(`KPCH4_${item.student_id}`, html, imgs);
  } else {
    printHtmlDocument(buildKPCH4Html(item, false, 0));
  }
}

function openStudentEditModal(type, idx) {
  const item = type === '12'
    ? CURRENT_STATUS_DATA.approvals12[idx]
    : CURRENT_STATUS_DATA.submissions[idx];
  if (!item) return;

  document.getElementById('se_type').value = type;
  document.getElementById('se_id').value = item.id;
  document.getElementById('se_orig_student_id').value = item.student_id || '';
  document.getElementById('se_student_id').value = item.student_id || '';
  document.getElementById('se_student_name').value = item.student_name || '';
  document.getElementById('se_level').value = item.level || 'มัธยมศึกษาตอนปลาย';
  document.getElementById('se_teacher_id').value = item.teacher_id || '';
  document.getElementById('se_group_name').value = item.group_name || '';
  document.getElementById('se_category').value = item.category || '';
  document.getElementById('se_hours').value = item.hours || '';
  document.getElementById('se_role_note').value = item.role_note || '';
  document.getElementById('se_activity_name').value = item.activity_name || '';
  document.getElementById('se_start_date').value = formatDateInput(item.start_date);
  document.getElementById('se_end_date').value = formatDateInput(item.end_date);
  document.getElementById('se_location').value = item.location || '';

  const is12 = type === '12';
  document.getElementById('se_p12_wrap').style.display = is12 ? 'block' : 'none';
  document.getElementById('se_sig_wrap').style.display = is12 ? 'block' : 'none';
  document.getElementById('se_role_wrap').style.display = is12 ? 'block' : 'none';
  document.getElementById('se_k4_wrap').style.display = is12 ? 'none' : 'block';

  if (is12) {
    document.getElementById('se_plan_detail').value = item.plan_detail || '';
    document.getElementById('se_expected_outcome').value = item.expected_outcome || '';
  } else {
    document.getElementById('se_k4_plan').value = item.k4_plan || '';
    document.getElementById('se_detail').value = item.detail || '';
    document.getElementById('se_k4_learning').value = item.k4_learning || '';
    document.getElementById('se_k4_problem').value = item.k4_problem || '';
    document.getElementById('se_k4_apply').value = item.k4_apply || '';
    SELECTED_STUDENT_EDIT_IMAGES = [];
    document.getElementById('se_images').value = '';
    const box = document.getElementById('se_imagePreviewBox');
    box.innerHTML = (item.images || []).map(u => `<img src="${escHtml(getDriveDirectImgUrl(u))}" class="thumb-preview" alt="existing">`).join('');
  }

  const modalEl = document.getElementById('studentEditModal');
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
  if (is12) {
    setTimeout(() => loadSignatureToPad('se_sig_canvas', item.student_signature || ''), 180);
  }
}

async function saveStudentEdit(e) {
  e.preventDefault();
  const type = document.getElementById('se_type').value;
  const newSid = document.getElementById('se_student_id').value.trim();
  if (!/^6\d{9}$/.test(newSid)) {
    return Swal.fire('รหัสนักศึกษาไม่ถูกต้อง', 'กรุณากรอกรหัสนักศึกษา 10 หลัก (ขึ้นต้นด้วยเลข 6)', 'warning');
  }

  const sd = document.getElementById('se_start_date').value;
  const ed = document.getElementById('se_end_date').value;
  const payload = {
    item_type: type,
    id: document.getElementById('se_id').value,
    original_student_id: document.getElementById('se_orig_student_id').value,
    student_id: newSid,
    student_name: document.getElementById('se_student_name').value.trim(),
    level: document.getElementById('se_level').value,
    teacher_id: document.getElementById('se_teacher_id').value,
    group_name: document.getElementById('se_group_name').value.trim(),
    category: document.getElementById('se_category').value,
    hours: Number(document.getElementById('se_hours').value || 0),
    role_note: document.getElementById('se_role_note').value.trim(),
    activity_name: document.getElementById('se_activity_name').value.trim(),
    start_date: sd,
    end_date: ed,
    location: document.getElementById('se_location').value.trim()
  };

  if (type === '12') {
    payload.plan_start_date = sd;
    payload.plan_end_date = ed;
    payload.plan_detail = document.getElementById('se_plan_detail').value.trim();
    payload.expected_outcome = document.getElementById('se_expected_outcome').value.trim();
    const sig = exportSignatureDataUrl('se_sig_canvas');
    if (sig) payload.student_signature = sig;
  } else {
    const det = document.getElementById('se_detail').value.trim();
    payload.k4_plan = document.getElementById('se_k4_plan').value.trim();
    payload.activity_detail = det;
    payload.detail = det;
    payload.k4_learning = document.getElementById('se_k4_learning').value.trim();
    payload.k4_problem = document.getElementById('se_k4_problem').value.trim();
    payload.k4_apply = document.getElementById('se_k4_apply').value.trim();
    if (SELECTED_STUDENT_EDIT_IMAGES.length) {
      payload.images = SELECTED_STUDENT_EDIT_IMAGES.map(x => ({ base64Data: x.base64Data, mimeType: x.mimeType }));
    }
  }

  const res = await callApi('studentUpdateRecord', { payload }, true, 'กำลังบันทึกการแก้ไข...');
  if (!res.success) {
    return Swal.fire('บันทึกไม่สำเร็จ', res.message || 'เกิดข้อผิดพลาด', 'error');
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('studentEditModal')).hide();
  document.getElementById('searchStudentId').value = res.student_id || newSid;
  await Swal.fire('สำเร็จ', 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว', 'success');
  searchMyStatus();
}

// ==================== KPCH 1-2 Official Form Builder ====================
function buildKPCH12Html(items, forWord = false) {
  return items.map((it, idx) => {
    const teacherName = it.teacher_name || '............................................';
    const sigHtml = renderStudentSigHtml(it.student_signature, 38, forWord ? `sig_stu_${idx}` : '');
    const sigFallback = sigHtml || '<div style="height:34px;"></div>';
    const isApproved = it.status === 'APPROVED_12' || it.status === 'APPROVED';
    const approveMark = isApproved ? '☑ อนุมัติ   ☐ ไม่อนุมัติ' : '☐ อนุมัติ   ☐ ไม่อนุมัติ';

    return `
      <div class="doc-page" style="padding: 10mm 14mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; color: #000; font-size: 15pt; line-height: 1.35;">
        <div style="text-align: right; font-weight: bold;">แบบ กพช. 1</div>
        <div style="text-align: center; font-weight: bold; font-size: 16pt; margin-bottom: 8px;">
          แบบคำขอทำกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)<br>
          ${escHtml(SCHOOL_NAME_TH)}
        </div>
        <div style="margin-bottom: 6px;">
          <strong>เลขที่คำขอ:</strong> ${escHtml(it.id)} &nbsp;&nbsp;&nbsp;
          <strong>วันที่ยื่น:</strong> ${escHtml(formatThaiDate(it.created_at))}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;" border="1" cellpadding="6">
          <tr>
            <td style="width: 55%;"><strong>ชื่อ-นามสกุล:</strong> ${escHtml(it.student_name)}</td>
            <td style="width: 45%;"><strong>รหัสนักศึกษา:</strong> ${escHtml(it.student_id)}</td>
          </tr>
          <tr>
            <td><strong>ระดับการศึกษา:</strong> ${escHtml(it.level)}</td>
            <td><strong>ศกร.ตำบล / กลุ่ม:</strong> ${escHtml(it.group_name || '-')}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>ชื่อโครงการ / กิจกรรม:</strong> ${escHtml(it.activity_name)}</td>
          </tr>
          <tr>
            <td><strong>ประเภทกิจกรรม:</strong> ${escHtml(it.category)}</td>
            <td><strong>จำนวนชั่วโมงที่ขอ:</strong> ${escHtml(it.hours)} ชั่วโมง</td>
          </tr>
          <tr>
            <td><strong>ระยะเวลาดำเนินการ:</strong> ${escHtml(formatDateRangeThai(it.start_date, it.end_date))}</td>
            <td><strong>บทบาทหน้าที่:</strong> ${escHtml(it.role_note || 'ผู้เรียน')}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>สถานที่จัดกิจกรรม:</strong> ${escHtml(it.location)}</td>
          </tr>
        </table>

        <div style="margin-top: 14px;">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: bottom; padding-top: 8px;">
                ${sigFallback}
                <div>ลงชื่อ ....................................................</div>
                <div>( ${escHtml(it.student_name)} )</div>
                <div>นักศึกษาผู้ยื่นคำขอ</div>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: bottom; padding-top: 8px;">
                <div style="margin-bottom: 6px; font-weight: bold;">${approveMark}</div>
                <div style="height: 22px;"></div>
                <div>ลงชื่อ ....................................................</div>
                <div>( ${escHtml(teacherName)} )</div>
                <div>ครูที่ปรึกษา / ผู้อนุมัติ</div>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <div class="doc-page" style="padding: 10mm 14mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; color: #000; font-size: 15pt; line-height: 1.35;">
        <div style="text-align: right; font-weight: bold;">แบบ กพช. 2</div>
        <div style="text-align: center; font-weight: bold; font-size: 16pt; margin-bottom: 10px;">
          แบบเสนอโครงการ / แผนการทำกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)<br>
          ${escHtml(SCHOOL_NAME_TH)}
        </div>
        <table style="width: 100%; border-collapse: collapse;" border="1" cellpadding="7">
          <tr>
            <td style="width: 28%; font-weight: bold; background: #f8fafc;">1. ชื่อโครงการ / กิจกรรม</td>
            <td>${escHtml(it.activity_name)}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f8fafc;">2. ผู้เสนอโครงการ</td>
            <td>${escHtml(it.student_name)} (รหัส ${escHtml(it.student_id)}) ระดับ ${escHtml(it.level)}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f8fafc;">3. ประเภทและจำนวนชั่วโมง</td>
            <td>${escHtml(it.category)} — จำนวน ${escHtml(it.hours)} ชั่วโมง</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f8fafc;">4. วัน เวลา และสถานที่</td>
            <td>${escHtml(formatDateRangeThai(it.start_date, it.end_date))} ณ ${escHtml(it.location)}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f8fafc; vertical-align: top;">5. วัตถุประสงค์ / แผนดำเนินงาน</td>
            <td style="white-space: pre-wrap;">${escHtml(it.plan_detail || '-')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background: #f8fafc; vertical-align: top;">6. ผลที่คาดว่าจะได้รับ</td>
            <td style="white-space: pre-wrap;">${escHtml(it.expected_outcome || '-')}</td>
          </tr>
        </table>

        <table style="width: 100%; border: none; margin-top: 22px;">
          <tr>
            <td style="width: 50%; text-align: center; vertical-align: bottom;">
              ${sigFallback}
              <div>ลงชื่อ .................................................... ผู้เสนอ</div>
              <div>( ${escHtml(it.student_name)} )</div>
              <div>ผู้เรียน / นักศึกษา</div>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: bottom;">
              <div style="height: 34px;"></div>
              <div>ลงชื่อ .................................................... ผู้เห็นชอบ</div>
              <div>( ${escHtml(teacherName)} )</div>
              <div>ครูที่ปรึกษา</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }).join('');
}

// ==================== Auth & Dashboard Core ====================
function openLoginModal() {
  bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).show();
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login_username').value.trim();
  const password = document.getElementById('login_password').value;
  const res = await callApi('login', { username, password }, true, 'กำลังเข้าสู่ระบบ...');
  if (!res.success || !res.token) {
    return Swal.fire('เข้าสู่ระบบไม่สำเร็จ', res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
  }
  CURRENT_TOKEN = res.token;
  CURRENT_USER = res.user;
  localStorage.setItem('kpch_token', CURRENT_TOKEN);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).hide();
  document.getElementById('login_password').value = '';
  enterDashboardMode();
}

function logout() {
  callApi('logout', { token: CURRENT_TOKEN }, false);
  CURRENT_TOKEN = '';
  CURRENT_USER = null;
  localStorage.removeItem('kpch_token');
  document.getElementById('dashboardSection').style.display = 'none';
  document.getElementById('publicSection').style.display = 'block';
  renderNavbar();
  switchPublicTab('pre12');
  checkSystemStatusNow(false);
}

function openChangePassModal() {
  document.getElementById('cp_old').value = '';
  document.getElementById('cp_new').value = '';
  document.getElementById('cp_confirm').value = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('changePassModal')).show();
}

async function handleChangePass(e) {
  e.preventDefault();
  const old_pass = document.getElementById('cp_old').value;
  const new_pass = document.getElementById('cp_new').value;
  const confirm = document.getElementById('cp_confirm').value;
  if (new_pass !== confirm) {
    return Swal.fire('รหัสผ่านไม่ตรงกัน', 'กรุณากรอกรหัสผ่านใหม่ทั้งสองช่องให้ตรงกัน', 'warning');
  }
  const res = await callApi('changePassword', { token: CURRENT_TOKEN, old_pass, new_pass }, true, 'กำลังเปลี่ยนรหัสผ่าน...');
  if (!res.success) {
    return Swal.fire('ไม่สำเร็จ', res.message || 'รหัสผ่านเดิมไม่ถูกต้อง', 'error');
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('changePassModal')).hide();
  Swal.fire('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
}

async function enterDashboardMode() {
  document.getElementById('publicSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  renderNavbar();
  await loadDashboardData();
  if (CURRENT_USER.role === 'TEACHER') switchTeacherTab(ACTIVE_TEACHER_TAB);
  else if (CURRENT_USER.role === 'ADMIN') switchAdminTab(ACTIVE_ADMIN_TAB);
  else {
    document.getElementById('desktopPageTitle').textContent = 'งานทะเบียน : บันทึกชั่วโมง กพช.';
    document.getElementById('desktopPageSubtitle').textContent = 'ตรวจสอบรายการที่ครูอนุมัติแล้วและกดบันทึกชั่วโมงลงทะเบียน';
    showOnlyDashView('dashSubsView');
  }
}

function showOnlyDashView(viewId) {
  const views = [
    'dashSubsView', 'dashReq12View', 'adminCategoriesView',
    'adminUsersView', 'adminAnnView', 'adminMaintView',
    'adminLogsView', 'adminTrashView'
  ];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === viewId ? 'block' : 'none';
  });
}

function switchTeacherTab(tab) {
  ACTIVE_TEACHER_TAB = tab;
  document.querySelectorAll('[data-teacher-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-teacher-tab') === tab);
  });
  showOnlyDashView(tab === 'req12' ? 'dashReq12View' : 'dashSubsView');
  document.getElementById('desktopPageTitle').textContent = tab === 'req12'
    ? 'ครูที่ปรึกษา : คำขออนุมัติ กพช. 1-2'
    : 'ครูที่ปรึกษา : ตรวจหลักฐาน กพช. 4';
  document.getElementById('desktopPageSubtitle').textContent = tab === 'req12'
    ? 'พิจารณาอนุมัติคำขอทำกิจกรรมล่วงหน้าและสร้างบันทึกข้อความ กพช. 3'
    : 'ตรวจภาพถ่ายและผลการทำกิจกรรมของนักศึกษา';
}

async function loadDashboardData(silent = false) {
  if (!CURRENT_TOKEN) return;
  const res = await callApi('getDashboard', { token: CURRENT_TOKEN }, !silent, 'กำลังโหลดข้อมูล...');
  if (!res.success) {
    if (res.maintenance_blocked || res.auth_error) {
      logout();
      return;
    }
    return Swal.fire('โหลดข้อมูลไม่สำเร็จ', res.message || '', 'error');
  }

  CURRENT_USER = res.user;
  DASHBOARD_DATA = {
    submissions: (res.items || res.submissions || []).map(normSub),
    requests12: (res.items12 || res.requests12 || []).map(norm12),
    users: res.users || [],
    categories: res.categories || [],
    logs: res.logs || [],
    trash12: (res.trash_approvals12 || res.trash12 || []).map(norm12),
    trashSubs: (res.trash_submissions || res.trashSubs || []).map(normSub),
    maintenance: res.maintenance || null,
    doc_templates_admin: res.doc_templates_admin || null,
    announcement: res.announcement || null
  };
  DOC_TEMPLATES_READY = res.doc_templates || DOC_TEMPLATES_READY;

  if (res.maintenance) applyMaintenanceState(res.maintenance);
  renderNavbar();

  const ann = extractAnnouncementText(res.announcement);
  const dashAnn = document.getElementById('annDashBox');
  if (dashAnn) {
    document.getElementById('annDashText').textContent = ann;
    dashAnn.style.display = ann ? 'block' : 'none';
  }

  const isTeacher = CURRENT_USER.role === 'TEACHER';
  document.getElementById('filterTeacherWrap').style.display = isTeacher ? 'none' : 'block';
  document.getElementById('filter12TeacherWrap').style.display = isTeacher ? 'none' : 'block';

  const teachersForFilter = PUBLIC_TEACHERS.length ? PUBLIC_TEACHERS : DASHBOARD_DATA.users.filter(u => u.role === 'TEACHER');
  ['filterTeacher', 'filter12Teacher'].forEach(fid => {
    const sel = document.getElementById(fid);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="ALL">ครูทุกคน</option>' +
      teachersForFilter.map(t => `<option value="${escHtml(t.user_id)}">${escHtml(t.full_name)}</option>`).join('');
    if (prev) sel.value = prev;
  });

  const terms = [...new Set(DASHBOARD_DATA.submissions.map(s => s.term_year).filter(Boolean))];
  const termSel = document.getElementById('filterTerm');
  if (termSel) {
    const prev = termSel.value;
    termSel.innerHTML = '<option value="ALL">ทุกภาคเรียน</option>' + terms.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
    if (prev && terms.includes(prev)) termSel.value = prev;
  }

  const waitSub = DASHBOARD_DATA.submissions.filter(s => s.status === 'WAIT_TEACHER' || s.status === 'PENDING_TEACHER').length;
  const wait12 = DASHBOARD_DATA.requests12.filter(r => r.status === 'WAIT_TEACHER_12' || r.status === 'PENDING_TEACHER').length;
  const trashTotal = DASHBOARD_DATA.trash12.length + DASHBOARD_DATA.trashSubs.length;

  ['sbBadgeWaitSub', 'badgeWaitSub'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = waitSub; });
  ['sbBadgeWait12', 'badgeWait12'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = wait12; });
  ['sbBadgeTrashCount', 'badgeTrashCount'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = trashTotal; });

  document.getElementById('statTotal').textContent = DASHBOARD_DATA.submissions.length;
  document.getElementById('statWait').textContent = waitSub;
  document.getElementById('statApproved').textContent = DASHBOARD_DATA.submissions.filter(s => s.status === 'APPROVED_FOR_REGISTRAR' || s.status === 'PENDING_REGISTRAR').length;
  document.getElementById('statCompleted').textContent = DASHBOARD_DATA.submissions.filter(s => s.status === 'COMPLETED').length;

  renderSubmissionsTable();
  renderReq12Table();
  if (CURRENT_USER.role === 'ADMIN') renderAdminPanels();
}
// ==================== KPCH 1-2 Management ====================
function match12Status(actual, filterVal) {
  if (filterVal === 'ALL') return true;
  if (filterVal === 'PENDING_TEACHER') return actual === 'WAIT_TEACHER_12' || actual === 'PENDING_TEACHER';
  if (filterVal === 'APPROVED') return actual === 'APPROVED_12' || actual === 'APPROVED';
  if (filterVal === 'REJECTED') return actual === 'REJECTED_12' || actual === 'REJECTED';
  return actual === filterVal;
}

function matchSubStatus(actual, filterVal) {
  if (filterVal === 'ALL') return true;
  if (filterVal === 'PENDING_TEACHER') return actual === 'WAIT_TEACHER' || actual === 'PENDING_TEACHER';
  if (filterVal === 'PENDING_REGISTRAR') return actual === 'APPROVED_FOR_REGISTRAR' || actual === 'PENDING_REGISTRAR';
  return actual === filterVal;
}

function getFiltered12() {
  const kw = (document.getElementById('filter12Keyword')?.value || '').trim().toLowerCase();
  const st = document.getElementById('filter12Status')?.value || 'ALL';
  const tc = document.getElementById('filter12Teacher')?.value || 'ALL';

  return DASHBOARD_DATA.requests12.filter(r => {
    if (!match12Status(r.status, st)) return false;
    if (tc !== 'ALL' && r.teacher_id !== tc) return false;
    if (kw) {
      const hay = `${r.id} ${r.student_id} ${r.student_name} ${r.activity_name} ${r.category}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function renderReq12Table() {
  const list = getFiltered12();
  const tbody = document.getElementById('req12TableBody');
  const mbox = document.getElementById('req12MobileList');
  const batchBar = document.getElementById('req12BatchButtons');

  if (batchBar) {
    batchBar.innerHTML = `
      <button type="button" class="btn btn-success btn-sm rounded-3" onclick="batchApprove12UI()"><i class="bi bi-check2-all me-1"></i>อนุมัติที่เลือก</button>
      <button type="button" class="btn btn-danger btn-sm rounded-3" onclick="batchReject12UI()"><i class="bi bi-x-circle me-1"></i>ไม่อนุมัติที่เลือก</button>
      <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="printBatch12UI()"><i class="bi bi-printer me-1"></i>พิมพ์ / Word กพช. 1-2</button>
      <button type="button" class="btn btn-primary btn-sm rounded-3" onclick="openDoc56ModalSelected()"><i class="bi bi-file-earmark-richtext me-1"></i>บันทึกข้อความ กพช. 3</button>
    `;
  }

  if (!list.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่พบคำขอ กพช. 1-2 ตามเงื่อนไข</td></tr>';
    if (mbox) mbox.innerHTML = '<div class="cute-card p-4 text-center text-muted">ไม่พบคำขอ กพช. 1-2</div>';
    update12SelectedCount();
    return;
  }

  if (tbody) {
    tbody.innerHTML = list.map(r => {
      const hasSig = r.student_signature && String(r.student_signature).startsWith('data:image/');
      return `<tr>
        <td><input type="checkbox" class="form-check-input chk-12" value="${escHtml(r.id)}" onchange="update12SelectedCount()"></td>
        <td>
          <div class="fw-bold">${escHtml(r.student_id)} ${hasSig ? '<i class="bi bi-pen text-info ms-1" title="มีลายเซ็นออนไลน์"></i>' : ''}</div>
          <div>${escHtml(r.student_name)}</div>
          <div class="text-muted" style="font-size:0.74rem;">${escHtml(r.id)}</div>
        </td>
        <td>
          <div class="fw-semibold">${escHtml(r.activity_name)}</div>
          <div class="text-muted" style="font-size:0.75rem;">${escHtml(r.category)}</div>
        </td>
        <td class="text-center fw-bold">${escHtml(r.hours)}</td>
        <td>${escHtml(r.teacher_name || '-')}</td>
        <td>${statusBadge12(r.status)}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="open12DetailModal('${escHtml(r.id)}')">
            <i class="bi bi-eye me-1"></i>ดู / จัดการ
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  if (mbox) {
    mbox.innerHTML = list.map(r => `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div class="form-check">
            <input type="checkbox" class="form-check-input chk-12-m" value="${escHtml(r.id)}" onchange="syncMobileCheck12('${escHtml(r.id)}', this.checked)">
            <span class="fw-bold small">${escHtml(r.student_id)}</span>
          </div>
          ${statusBadge12(r.status)}
        </div>
        <div class="fw-semibold">${escHtml(r.student_name)}</div>
        <div class="small text-primary mb-1">${escHtml(r.activity_name)} (${escHtml(r.hours)} ชม.)</div>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <span class="text-muted" style="font-size:0.74rem;">${escHtml(r.id)}</span>
          <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="open12DetailModal('${escHtml(r.id)}')">ดู / จัดการ</button>
        </div>
      </div>
    `).join('');
  }
  update12SelectedCount();
}

function syncMobileCheck12(id, checked) {
  document.querySelectorAll(`.chk-12[value="${CSS.escape(id)}"]`).forEach(c => { c.checked = checked; });
  update12SelectedCount();
}

function toggleSelectAll12(checked) {
  document.querySelectorAll('.chk-12, .chk-12-m').forEach(c => { c.checked = checked; });
  update12SelectedCount();
}

function getSelected12Ids() {
  const desktop = Array.from(document.querySelectorAll('.chk-12:checked')).map(c => c.value);
  const mobile = Array.from(document.querySelectorAll('.chk-12-m:checked')).map(c => c.value);
  return [...new Set([...desktop, ...mobile])];
}

function getSelected12Items() {
  const ids = getSelected12Ids();
  return DASHBOARD_DATA.requests12.filter(r => ids.includes(r.id));
}

function update12SelectedCount() {
  const n = getSelected12Ids().length;
  const badge = document.getElementById('req12SelectedCount');
  if (badge) badge.textContent = `เลือก ${n} รายการ`;
}

function open12DetailModal(id) {
  const it = DASHBOARD_DATA.requests12.find(r => r.id === id);
  if (!it) return;
  const isAdmin = CURRENT_USER && CURRENT_USER.role === 'ADMIN';
  const canApprove = CURRENT_USER && (CURRENT_USER.role === 'TEACHER' || isAdmin);
  const isWaiting = it.status === 'WAIT_TEACHER_12' || it.status === 'PENDING_TEACHER';
  const sigImg = it.student_signature && String(it.student_signature).startsWith('data:image/')
    ? `<img src="${it.student_signature}" alt="ลายเซ็น" style="max-height:64px; border:1px dashed #cbd5e1; padding:4px; border-radius:8px; background:#fff;">`
    : '<span class="text-muted small">ไม่มีลายเซ็นแนบ</span>';

  document.getElementById('detail12Body').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <span class="badge bg-light text-dark border fs-6">${escHtml(it.id)}</span>
      ${statusBadge12(it.status)}
    </div>
    <div class="row g-2 small mb-3">
      <div class="col-md-6"><strong>รหัสนักศึกษา:</strong> ${escHtml(it.student_id)}</div>
      <div class="col-md-6"><strong>ชื่อ-นามสกุล:</strong> ${escHtml(it.student_name)}</div>
      <div class="col-md-6"><strong>ระดับการศึกษา:</strong> ${escHtml(it.level)}</div>
      <div class="col-md-6"><strong>กลุ่ม / ศกร.ตำบล:</strong> ${escHtml(it.group_name || '-')}</div>
      <div class="col-md-6"><strong>ครูที่ปรึกษา:</strong> ${escHtml(it.teacher_name || '-')}</div>
      <div class="col-md-6"><strong>ประเภท / ชั่วโมง:</strong> ${escHtml(it.category)} (${escHtml(it.hours)} ชม.)</div>
      <div class="col-12"><strong>ชื่อโครงการ:</strong> ${escHtml(it.activity_name)}</div>
      <div class="col-md-6"><strong>ระยะเวลา:</strong> ${escHtml(formatDateRangeThai(it.start_date, it.end_date))}</div>
      <div class="col-md-6"><strong>สถานที่:</strong> ${escHtml(it.location)}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">วัตถุประสงค์ / แผนดำเนินงาน</div>
      <div class="detail-text-box">${escHtml(it.plan_detail || '-')}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">ผลที่คาดว่าจะได้รับ</div>
      <div class="detail-text-box">${escHtml(it.expected_outcome || '-')}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">ลายเซ็นนักศึกษาผู้ยื่น</div>
      <div>${sigImg}</div>
    </div>
    ${it.teacher_comment ? `<div class="alert alert-light border small mt-2 mb-0"><strong>ความเห็นครู:</strong> ${escHtml(it.teacher_comment)}</div>` : ''}
  `;

  let footer = `
    <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="printForm12('${escHtml(it.id)}')">
      <i class="bi bi-printer me-1"></i>พิมพ์ / Word (กพช. 1-2)
    </button>
    <button type="button" class="btn btn-outline-warning btn-sm rounded-3" onclick="staffPromptFixStudentId('12', '${escHtml(it.id)}')">
      <i class="bi bi-pencil me-1"></i>แก้รหัส นศ.
    </button>
    <button type="button" class="btn btn-outline-info btn-sm rounded-3" onclick="openDoc56ModalSingle('${escHtml(it.id)}')">
      <i class="bi bi-file-earmark-richtext me-1"></i>บันทึก กพช. 3
    </button>
  `;
  if (canApprove && isWaiting) {
    footer += `
      <button type="button" class="btn btn-success btn-sm rounded-3" onclick="process12Single('${escHtml(it.id)}', 'APPROVE')">
        <i class="bi bi-check-lg me-1"></i>อนุมัติ
      </button>
      <button type="button" class="btn btn-danger btn-sm rounded-3" onclick="process12Single('${escHtml(it.id)}', 'REJECT')">
        <i class="bi bi-x-lg me-1"></i>ไม่อนุมัติ
      </button>
    `;
  }
  if (isAdmin) {
    footer += `<button type="button" class="btn btn-outline-danger btn-sm rounded-3" onclick="softDelete12UI('${escHtml(it.id)}')">
      <i class="bi bi-trash3 me-1"></i>ย้ายลงถังขยะ
    </button>`;
  }
  document.getElementById('detail12Footer').innerHTML = footer;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detail12Modal')).show();
}

function openDoc56ModalSingle(id) {
  const it = DASHBOARD_DATA.requests12.find(r => r.id === id);
  if (!it) return;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detail12Modal')).hide();
  openDoc56ModalWithItems([it]);
}

async function printForm12(id) {
  const it = DASHBOARD_DATA.requests12.find(r => r.id === id);
  if (!it) return;
  const mode = await askPrintOrWordChoice('เอกสาร กพช. 1-2');
  if (!mode) return;
  if (mode === 'word') {
    const imgs = it.student_signature ? [{ cid: 'sig_stu_0', url: it.student_signature }] : [];
    await downloadWordMhtml(`KPCH12_${it.student_id}`, buildKPCH12Html([it], true), imgs);
  } else {
    printHtmlDocument(buildKPCH12Html([it], false));
  }
}

async function printBatch12UI() {
  const items = getSelected12Items();
  if (!items.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกคำขอ กพช. 1-2 อย่างน้อย 1 รายการ', 'warning');
  const mode = await askPrintOrWordChoice(`เอกสาร กพช. 1-2 (${items.length} ชุด)`);
  if (!mode) return;
  if (mode === 'word') {
    const imgs = [];
    items.forEach((it, idx) => {
      if (it.student_signature) imgs.push({ cid: `sig_stu_${idx}`, url: it.student_signature });
    });
    await downloadWordMhtml(`KPCH12_Batch_${items.length}`, buildKPCH12Html(items, true), imgs);
  } else {
    printHtmlDocument(buildKPCH12Html(items, false));
  }
}

async function process12Single(id, decision) {
  const { value: reason, isConfirmed } = await Swal.fire({
    title: decision === 'APPROVE' ? 'ยืนยันอนุมัติคำขอ กพช. 1-2' : 'ยืนยันไม่อนุมัติคำขอ',
    input: 'text',
    inputLabel: decision === 'APPROVE' ? 'ความเห็นเพิ่มเติม (ถ้ามี)' : 'ระบุเหตุผลที่ไม่อนุมัติ / สิ่งที่ต้องแก้ไข',
    inputPlaceholder: 'ระบุข้อความ...',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });
  if (!isConfirmed) return;
  if (decision === 'REJECT' && !String(reason || '').trim()) {
    return Swal.fire('กรุณาระบุเหตุผล', 'กรุณาระบุเหตุผลในการตีกลับ/ไม่อนุมัติ', 'warning');
  }

  const res = await callApi('processApproval12', {
    token: CURRENT_TOKEN,
    req12_id: id,
    decision,
    reason: reason || ''
  }, true, 'กำลังบันทึกผลการพิจารณา...');

  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detail12Modal')).hide();
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'บันทึกผลการพิจารณา กพช. 1-2 เรียบร้อยแล้ว', 'success');
}

async function batchApprove12UI() {
  const ids = getSelected12Ids();
  if (!ids.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกคำขอที่ต้องการอนุมัติ', 'warning');
  const ok = await Swal.fire({ title: `อนุมัติคำขอ ${ids.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'อนุมัติทั้งหมด', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('batchApprove12', { token: CURRENT_TOKEN, req12_ids: ids }, true, 'กำลังอนุมัติแบบกลุ่ม...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', `อนุมัติคำขอเรียบร้อย ${res.count || res.updated || ids.length} รายการ`, 'success');
}

async function batchReject12UI() {
  const ids = getSelected12Ids();
  if (!ids.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกคำขอที่ต้องการไม่อนุมัติ', 'warning');
  const { value: reason, isConfirmed } = await Swal.fire({
    title: `ไม่อนุมัติ ${ids.length} รายการ`,
    input: 'text',
    inputLabel: 'เหตุผลที่ไม่อนุมัติ',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });
  if (!isConfirmed) return;
  if (!String(reason || '').trim()) return Swal.fire('กรุณาระบุเหตุผล', '', 'warning');
  const res = await callApi('batchReject12', { token: CURRENT_TOKEN, req12_ids: ids, reason: reason.trim() }, true, 'กำลังบันทึกผล...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'บันทึกผลเรียบร้อยแล้ว', 'success');
}

// ==================== Doc 5-6 (Memo KPCH 3) ====================
function openDoc56ModalSelected() {
  const items = getSelected12Items();
  if (!items.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกคำขอ กพช. 1-2 อย่างน้อย 1 รายการ', 'warning');
  openDoc56ModalWithItems(items);
}

function openDoc56ModalWithItems(items) {
  DOC56_ITEMS = items || [];
  const first = DOC56_ITEMS[0] || {};
  const gdocBar = document.getElementById('d56_gdoc_bar');
  const hasTpl = DOC_TEMPLATES_READY.memo56 || (DASHBOARD_DATA.doc_templates_admin && DASHBOARD_DATA.doc_templates_admin.memo56_url);
  if (gdocBar) gdocBar.style.display = hasTpl ? 'block' : 'none';

  document.getElementById('d56_doc_no').value = 'ศธ ๐๒๑๐.๒๔๐๔/......';
  document.getElementById('d56_doc_date').value = formatThaiDate(new Date().toISOString().slice(0, 10));
  document.getElementById('d56_project_name').value = first.activity_name || '';
  document.getElementById('d56_student_count').value = DOC56_ITEMS.length;
  document.getElementById('d56_start_date').value = formatThaiDate(first.start_date);
  document.getElementById('d56_end_date').value = formatThaiDate(first.end_date);
  document.getElementById('d56_location').value = first.location || '';
  document.getElementById('d56_advisor_name').value = first.teacher_name || (CURRENT_USER ? CURRENT_USER.full_name : '');
  document.getElementById('d56_student_list').value = DOC56_ITEMS
    .map((x, i) => `${i + 1}. ${x.student_name} (${x.student_id}) ระดับ ${x.level} — ${x.hours} ชม.`)
    .join('\n');

  bootstrap.Modal.getOrCreateInstance(document.getElementById('doc56Modal')).show();
}

function buildDoc56Html(forWord = false) {
  const docNo = document.getElementById('d56_doc_no').value.trim();
  const docDate = document.getElementById('d56_doc_date').value.trim();
  const projName = document.getElementById('d56_project_name').value.trim();
  const stCount = document.getElementById('d56_student_count').value.trim();
  const sDate = document.getElementById('d56_start_date').value.trim();
  const eDate = document.getElementById('d56_end_date').value.trim();
  const location = document.getElementById('d56_location').value.trim();
  const advisor = document.getElementById('d56_advisor_name').value.trim();
  const stListText = document.getElementById('d56_student_list').value.trim();

  const leader = DOC56_ITEMS[0] || {};
  const sigLeaderHtml = renderStudentSigHtml(leader.student_signature, 36, forWord ? 'sig_stu_0' : '');
  const garudaSrc = forWord ? 'cid:garuda_img' : GARUDA_URL;

  const rowsHtml = DOC56_ITEMS.map((x, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${escHtml(x.student_id)}</td>
      <td>${escHtml(x.student_name)}</td>
      <td>${escHtml(x.level)}</td>
      <td style="text-align:center;">${escHtml(x.hours)}</td>
      <td>${escHtml(x.role_note || 'ผู้เรียน')}</td>
    </tr>
  `).join('');

  return `
    <div class="doc-page" style="padding: 15mm 18mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; font-size: 16pt; color: #000; line-height: 1.35;">
      <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:10px;">
        <img src="${garudaSrc}" alt="ครุฑ" style="height:56px; width:auto;" onerror="this.style.display='none'">
        <div style="flex:1; text-align:center; font-size:22pt; font-weight:bold;">บันทึกข้อความ</div>
        <div style="width:56px;"></div>
      </div>
      <div><strong>ส่วนราชการ</strong> &nbsp; ${escHtml(SCHOOL_NAME_TH)}</div>
      <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px;">
        <div><strong>ที่</strong> &nbsp; ${escHtml(docNo)}</div>
        <div><strong>วันที่</strong> &nbsp; ${escHtml(docDate)}</div>
      </div>
      <div style="border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 12px;">
        <strong>เรื่อง</strong> &nbsp; ขออนุมัติจัดทำโครงการ / กิจกรรมพัฒนาคุณภาพชีวิต (กพช. 3)
      </div>
      <div style="margin-bottom: 10px;"><strong>เรียน</strong> &nbsp; ผู้อำนวยการ${escHtml(SCHOOL_NAME_TH)}</div>

      <p style="text-indent: 2.5cm; text-align: justify; margin-bottom: 8px;">
        ด้วยนักศึกษา ${escHtml(SCHOOL_NAME_TH)} จำนวน ${escHtml(toThaiDigits(stCount))} คน มีความประสงค์ขออนุมัติดำเนินโครงการ/กิจกรรมพัฒนาคุณภาพชีวิต (กพช.)
        เรื่อง <strong>${escHtml(projName)}</strong> ระหว่างวันที่ ${escHtml(toThaiDigits(sDate))} ถึงวันที่ ${escHtml(toThaiDigits(eDate))}
        ณ ${escHtml(location)} โดยมี ${escHtml(advisor)} เป็นครูที่ปรึกษากิจกรรม
      </p>
      <p style="text-indent: 2.5cm; text-align: justify; margin-bottom: 10px;">
        ในการนี้ จึงขออนุญาตเสนอรายชื่อนักศึกษาผู้เข้าร่วมโครงการและรายละเอียดแผนการดำเนินงาน ดังต่อไปนี้:
      </p>
      <div style="margin-left: 1.5cm; white-space: pre-wrap; margin-bottom: 14px; font-size: 15pt;">${escHtml(stListText)}</div>
      <p style="text-indent: 2.5cm; margin-bottom: 18px;">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>

      <table style="width:100%; border:none; margin-top: 12px;">
        <tr>
          <td style="width:50%; text-align:center; vertical-align:bottom;">
            ${sigLeaderHtml || '<div style="height:34px;"></div>'}
            <div>ลงชื่อ .................................................... ผู้เสนอโครงการ</div>
            <div>( ${escHtml(leader.student_name || '............................................')} )</div>
            <div>ประธานโครงการ / ตัวแทนนักศึกษา</div>
          </td>
          <td style="width:50%; text-align:center; vertical-align:bottom;">
            <div style="height:34px;"></div>
            <div>ลงชื่อ .................................................... ผู้รับรอง</div>
            <div>( ${escHtml(advisor)} )</div>
            <div>ครูที่ปรึกษา</div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 24px; text-align: center;">
        <div style="font-weight:bold; margin-bottom: 16px;">ความเห็นผู้อำนวยการ &nbsp;&nbsp; ☐ อนุมัติ &nbsp;&nbsp;&nbsp; ☐ ไม่อนุมัติ</div>
        <div>ลงชื่อ ....................................................</div>
        <div>( .................................................... )</div>
        <div>ผู้อำนวยการ${escHtml(SCHOOL_NAME_TH)}</div>
      </div>
    </div>

    <div class="doc-page" style="padding: 14mm 16mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; font-size: 15pt; color: #000;">
      <div style="text-align:right; font-weight:bold;">แบบ กพช. 3</div>
      <div style="text-align:center; font-weight:bold; font-size:16pt; margin-bottom: 10px;">
        บัญชีรายชื่อนักศึกษาผู้ขออนุมัติทำกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)<br>
        โครงการ: ${escHtml(projName)}
      </div>
      <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;">
        <thead style="background:#f1f5f9;">
          <tr>
            <th style="width:45px;">ที่</th>
            <th style="width:120px;">รหัสนักศึกษา</th>
            <th>ชื่อ-นามสกุล</th>
            <th style="width:130px;">ระดับการศึกษา</th>
            <th style="width:70px;">ชั่วโมง</th>
            <th style="width:120px;">บทบาทหน้าที่</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

async function executeOutputDoc56(mode) {
  if (mode === 'word') {
    const imgs = [{ cid: 'garuda_img', url: GARUDA_URL }];
    const leader = DOC56_ITEMS[0];
    if (leader && leader.student_signature) {
      imgs.push({ cid: 'sig_stu_0', url: leader.student_signature });
    }
    await downloadWordMhtml('Memo_KPCH3', buildDoc56Html(true), imgs);
  } else {
    printHtmlDocument(buildDoc56Html(false));
  }
}

// ==================== KPCH 5 & KPCH 4 Builders ====================
function buildKPCH5Html(items) {
  const first = items[0] || {};
  const rows = items.map((x, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${escHtml(x.student_id)}</td>
      <td>${escHtml(x.student_name)}</td>
      <td>${escHtml(x.level)}</td>
      <td style="text-align:center;">${escHtml(x.hours)}</td>
      <td style="text-align:center;">ผ่าน</td>
    </tr>
  `).join('');

  return `
    <div class="doc-page" style="padding: 14mm 16mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; font-size: 15pt; color: #000;">
      <div style="text-align:right; font-weight:bold;">แบบ กพช. 5</div>
      <div style="text-align:center; font-weight:bold; font-size:16pt; margin-bottom: 10px;">
        แบบสรุปรายชื่อผู้ผ่านกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)<br>
        กิจกรรม: ${escHtml(first.activity_name || '-')} (${escHtml(SCHOOL_NAME_TH)})
      </div>
      <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;">
        <thead style="background:#f1f5f9;">
          <tr>
            <th style="width:45px;">ที่</th>
            <th style="width:120px;">รหัสนักศึกษา</th>
            <th>ชื่อ-นามสกุล</th>
            <th style="width:140px;">ระดับการศึกษา</th>
            <th style="width:70px;">ชั่วโมง</th>
            <th style="width:85px;">ผลการประเมิน</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildKPCH4Html(it, forWord = false, itemIdx = 0) {
  const sigHtml = renderStudentSigHtml(it.student_signature, 38, forWord ? `sig_stu_${itemIdx}` : '');
  const imgs = (it.images || []).slice(0, 4);
  const photoCells = imgs.map((u, pIdx) => {
    const src = forWord ? `cid:photo_${itemIdx}_${pIdx}` : getDriveDirectImgUrl(u);
    return `<td style="width:50%; padding:8px; text-align:center; vertical-align:middle;">
      <img src="${escHtml(src)}" alt="ภาพกิจกรรม ${pIdx + 1}" style="max-width:100%; max-height:220px; border:1px solid #cbd5e1; border-radius:6px; object-fit:contain;">
      <div style="font-size:13pt; margin-top:4px;">ภาพที่ ${pIdx + 1}</div>
    </td>`;
  });

  let photoRows = '';
  for (let i = 0; i < photoCells.length; i += 2) {
    photoRows += `<tr>${photoCells[i]}${photoCells[i + 1] || '<td></td>'}</tr>`;
  }

  return `
    <div class="doc-page" style="padding: 12mm 15mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; font-size: 15pt; color: #000; line-height: 1.35;">
      <div style="text-align:right; font-weight:bold;">แบบ กพช. 4</div>
      <div style="text-align:center; font-weight:bold; font-size:16pt; margin-bottom: 8px;">
        แบบบันทึกผลการปฏิบัติกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)<br>
        ${escHtml(SCHOOL_NAME_TH)}
      </div>

      <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
        <tr>
          <td style="width:55%;"><strong>ชื่อ-นามสกุล:</strong> ${escHtml(it.student_name)}</td>
          <td><strong>รหัสนักศึกษา:</strong> ${escHtml(it.student_id)}</td>
        </tr>
        <tr>
          <td><strong>ระดับการศึกษา:</strong> ${escHtml(it.level)}</td>
          <td><strong>ภาคเรียนที่:</strong> ${escHtml(it.term_year || '-')}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>ชื่อกิจกรรม / โครงการ:</strong> ${escHtml(it.activity_name)}</td>
        </tr>
        <tr>
          <td><strong>ประเภทกิจกรรม:</strong> ${escHtml(it.category)}</td>
          <td><strong>จำนวนชั่วโมงจริง:</strong> ${escHtml(it.hours)} ชั่วโมง</td>
        </tr>
        <tr>
          <td><strong>วันเวลาที่ปฏิบัติ:</strong> ${escHtml(formatDateRangeThai(it.start_date, it.end_date))}</td>
          <td><strong>สถานที่:</strong> ${escHtml(it.location)}</td>
        </tr>
      </table>

      <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="width:30%; font-weight:bold; vertical-align:top; background:#f8fafc;">1. การวางแผนและเตรียมการ</td>
          <td style="white-space:pre-wrap;">${escHtml(it.k4_plan || '-')}</td>
        </tr>
        <tr>
          <td style="font-weight:bold; vertical-align:top; background:#f8fafc;">2. ขั้นตอนการดำเนินงาน / ผลสำเร็จ</td>
          <td style="white-space:pre-wrap;">${escHtml(it.detail || '-')}</td>
        </tr>
        <tr>
          <td style="font-weight:bold; vertical-align:top; background:#f8fafc;">3. สิ่งที่ได้เรียนรู้</td>
          <td style="white-space:pre-wrap;">${escHtml(it.k4_learning || '-')}</td>
        </tr>
        <tr>
          <td style="font-weight:bold; vertical-align:top; background:#f8fafc;">4. ปัญหาและแนวทางแก้ไข</td>
          <td style="white-space:pre-wrap;">${escHtml(it.k4_problem || '-')}</td>
        </tr>
        <tr>
          <td style="font-weight:bold; vertical-align:top; background:#f8fafc;">5. การนำไปประยุกต์ใช้</td>
          <td style="white-space:pre-wrap;">${escHtml(it.k4_apply || '-')}</td>
        </tr>
      </table>

      <table style="width:100%; border:none; margin-top: 18px;">
        <tr>
          <td style="width:34%; text-align:center; vertical-align:bottom;">
            ${sigHtml || '<div style="height:34px;"></div>'}
            <div>ลงชื่อ .......................................</div>
            <div>( ${escHtml(it.student_name)} )</div>
            <div>ผู้ดำเนินงาน / นักศึกษา</div>
          </td>
          <td style="width:33%; text-align:center; vertical-align:bottom;">
            <div style="height:34px;"></div>
            <div>ลงชื่อ .......................................</div>
            <div>( ${escHtml(it.teacher_name || '...................................')} )</div>
            <div>ครูที่ปรึกษา</div>
          </td>
          <td style="width:33%; text-align:center; vertical-align:bottom;">
            <div style="height:34px;"></div>
            <div>ลงชื่อ .......................................</div>
            <div>( งานทะเบียน )</div>
            <div>ผู้รับรองชั่วโมง กพช.</div>
          </td>
        </tr>
      </table>
    </div>
    ${photoRows ? `
      <div class="doc-page" style="padding: 12mm 15mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; font-size: 15pt; color: #000;">
        <div style="text-align:center; font-weight:bold; font-size:16pt; margin-bottom:10px;">
          ภาคผนวก : ภาพถ่ายประกอบกิจกรรม "${escHtml(it.activity_name)}"<br>
          ผู้จัดทำ: ${escHtml(it.student_name)} (${escHtml(it.student_id)})
        </div>
        <table border="1" style="width:100%; border-collapse:collapse;">${photoRows}</table>
      </div>
    ` : ''}
  `;
}

// ==================== KPCH 4 Submissions Management ====================
function getFilteredSubs() {
  const kw = (document.getElementById('filterKeyword')?.value || '').trim().toLowerCase();
  const st = document.getElementById('filterStatus')?.value || 'ALL';
  const tc = document.getElementById('filterTeacher')?.value || 'ALL';
  const tm = document.getElementById('filterTerm')?.value || 'ALL';
  const lv = document.getElementById('filterLevel')?.value || 'ALL';

  return DASHBOARD_DATA.submissions.filter(s => {
    if (!matchSubStatus(s.status, st)) return false;
    if (tc !== 'ALL' && s.teacher_id !== tc) return false;
    if (tm !== 'ALL' && s.term_year !== tm) return false;
    if (lv !== 'ALL' && s.level !== lv) return false;
    if (kw) {
      const hay = `${s.id} ${s.student_id} ${s.student_name} ${s.activity_name} ${s.category}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function renderSubmissionsTable() {
  const list = getFilteredSubs();
  const tbody = document.getElementById('subsTableBody');
  const mbox = document.getElementById('subsMobileList');
  const batchBar = document.getElementById('subBatchButtons');
  const role = CURRENT_USER ? CURRENT_USER.role : '';

  if (batchBar) {
    let btns = '';
    if (role === 'TEACHER' || role === 'ADMIN') {
      btns += `
        <button type="button" class="btn btn-success btn-sm rounded-3" onclick="batchApproveSubsUI()"><i class="bi bi-check2-all me-1"></i>อนุมัติที่เลือก</button>
        <button type="button" class="btn btn-danger btn-sm rounded-3" onclick="batchRejectSubsUI()"><i class="bi bi-x-circle me-1"></i>ไม่อนุมัติที่เลือก</button>
      `;
    }
    if (role === 'REGISTRAR' || role === 'ADMIN') {
      btns += `
        <button type="button" class="btn btn-success btn-sm rounded-3" onclick="batchCompleteRegistrarUI()"><i class="bi bi-award me-1"></i>บันทึกทะเบียนที่เลือก</button>
        <button type="button" class="btn btn-outline-success btn-sm rounded-3" onclick="exportRegistrarCSV()"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Export CSV</button>
      `;
    }
    btns += `
      <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="printBatchKPCH4()"><i class="bi bi-printer me-1"></i>พิมพ์ / Word กพช. 4</button>
      <button type="button" class="btn btn-primary btn-sm rounded-3" onclick="openDoc57ModalSelected()"><i class="bi bi-file-earmark-check me-1"></i>บันทึกข้อความ กพช. 4-6</button>
    `;
    batchBar.innerHTML = btns;
  }

  if (!list.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ไม่พบรายการหลักฐาน กพช. 4 ตามเงื่อนไข</td></tr>';
    if (mbox) mbox.innerHTML = '<div class="cute-card p-4 text-center text-muted">ไม่พบรายการหลักฐาน กพช. 4</div>';
    updateSubSelectedCount();
    return;
  }

  if (tbody) {
    tbody.innerHTML = list.map(s => `
      <tr>
        <td><input type="checkbox" class="form-check-input chk-sub" value="${escHtml(s.id)}" onchange="updateSubSelectedCount()"></td>
        <td>
          <div class="fw-bold">${escHtml(s.student_id)}</div>
          <div>${escHtml(s.student_name)}</div>
          <div class="text-muted" style="font-size:0.74rem;">${escHtml(s.id)}</div>
        </td>
        <td>
          <div class="fw-semibold">${escHtml(s.activity_name)}</div>
          <div class="text-muted" style="font-size:0.75rem;">${escHtml(s.category)}</div>
        </td>
        <td class="text-center fw-bold">${escHtml(s.hours)}</td>
        <td>
          <div>${escHtml(s.teacher_name || '-')}</div>
          <div class="text-muted" style="font-size:0.75rem;">ภาค ${escHtml(s.term_year || '-')}</div>
        </td>
        <td>${statusBadgeSub(s.status)}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="openDetailModal('${escHtml(s.id)}')">
            <i class="bi bi-eye me-1"></i>ดู / จัดการ
          </button>
        </td>
      </tr>
    `).join('');
  }

  if (mbox) {
    mbox.innerHTML = list.map(s => `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div class="form-check">
            <input type="checkbox" class="form-check-input chk-sub-m" value="${escHtml(s.id)}" onchange="syncMobileCheckSub('${escHtml(s.id)}', this.checked)">
            <span class="fw-bold small">${escHtml(s.student_id)}</span>
          </div>
          ${statusBadgeSub(s.status)}
        </div>
        <div class="fw-semibold">${escHtml(s.student_name)}</div>
        <div class="small text-primary mb-1">${escHtml(s.activity_name)} (${escHtml(s.hours)} ชม.)</div>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <span class="text-muted" style="font-size:0.74rem;">${escHtml(s.term_year || '-')} • ${escHtml(s.teacher_name || '-')}</span>
          <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="openDetailModal('${escHtml(s.id)}')">ดู / จัดการ</button>
        </div>
      </div>
    `).join('');
  }
  updateSubSelectedCount();
}

function syncMobileCheckSub(id, checked) {
  document.querySelectorAll(`.chk-sub[value="${CSS.escape(id)}"]`).forEach(c => { c.checked = checked; });
  updateSubSelectedCount();
}

function toggleSelectAllSubs(checked) {
  document.querySelectorAll('.chk-sub, .chk-sub-m').forEach(c => { c.checked = checked; });
  updateSubSelectedCount();
}

function getSelectedSubIds() {
  const desktop = Array.from(document.querySelectorAll('.chk-sub:checked')).map(c => c.value);
  const mobile = Array.from(document.querySelectorAll('.chk-sub-m:checked')).map(c => c.value);
  return [...new Set([...desktop, ...mobile])];
}

function getSelectedSubItems() {
  const ids = getSelectedSubIds();
  return DASHBOARD_DATA.submissions.filter(s => ids.includes(s.id));
}

function updateSubSelectedCount() {
  const n = getSelectedSubIds().length;
  const badge = document.getElementById('subSelectedCount');
  if (badge) badge.textContent = `เลือก ${n} รายการ`;
}

function openDetailModal(id) {
  const it = DASHBOARD_DATA.submissions.find(s => s.id === id);
  if (!it) return;
  const role = CURRENT_USER ? CURRENT_USER.role : '';
  const isAdmin = role === 'ADMIN';
  const canApprove = role === 'TEACHER' || isAdmin;
  const canRegistrar = role === 'REGISTRAR' || isAdmin;
  const isWaiting = it.status === 'WAIT_TEACHER' || it.status === 'PENDING_TEACHER';
  const isWaitReg = it.status === 'APPROVED_FOR_REGISTRAR' || it.status === 'PENDING_REGISTRAR';

  const imgsHtml = (it.images || []).length
    ? (it.images || []).map(u => `<a href="${escHtml(getDriveDirectImgUrl(u))}" target="_blank" rel="noopener noreferrer"><img src="${escHtml(getDriveDirectImgUrl(u))}" class="thumb-preview" alt="photo"></a>`).join('')
    : '<span class="text-muted small">ไม่มีภาพถ่ายแนบ</span>';

  const sigImg = it.student_signature && String(it.student_signature).startsWith('data:image/')
    ? `<img src="${it.student_signature}" alt="ลายเซ็น" style="max-height:58px; border:1px dashed #cbd5e1; padding:4px; border-radius:8px; background:#fff;">`
    : '<span class="text-muted small">ไม่มีลายเซ็นจาก กพช. 1-2</span>';

  document.getElementById('detailSubBody').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <span class="badge bg-light text-dark border fs-6">${escHtml(it.id)}</span>
      ${statusBadgeSub(it.status)}
    </div>
    <div class="row g-2 small mb-3">
      <div class="col-md-6"><strong>รหัสนักศึกษา:</strong> ${escHtml(it.student_id)}</div>
      <div class="col-md-6"><strong>ชื่อ-นามสกุล:</strong> ${escHtml(it.student_name)}</div>
      <div class="col-md-6"><strong>ระดับการศึกษา:</strong> ${escHtml(it.level)}</div>
      <div class="col-md-6"><strong>ภาคเรียน / กลุ่ม:</strong> ${escHtml(it.term_year || '-')} (${escHtml(it.group_name || '-')})</div>
      <div class="col-md-6"><strong>ครูที่ปรึกษา:</strong> ${escHtml(it.teacher_name || '-')}</div>
      <div class="col-md-6"><strong>ประเภท / ชั่วโมง:</strong> ${escHtml(it.category)} (${escHtml(it.hours)} ชม.)</div>
      <div class="col-12"><strong>ชื่อกิจกรรม:</strong> ${escHtml(it.activity_name)}</div>
      <div class="col-md-6"><strong>วันที่ปฏิบัติ:</strong> ${escHtml(formatDateRangeThai(it.start_date, it.end_date))}</div>
      <div class="col-md-6"><strong>สถานที่:</strong> ${escHtml(it.location)}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">1. การวางแผนและการเตรียมการ</div>
      <div class="detail-text-box">${escHtml(it.k4_plan || '-')}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">2. ขั้นตอนการดำเนินงาน / ผลที่เกิดขึ้นจริง</div>
      <div class="detail-text-box">${escHtml(it.detail || '-')}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">3. สิ่งที่ได้เรียนรู้</div>
      <div class="detail-text-box">${escHtml(it.k4_learning || '-')}</div>
    </div>
    <div class="row g-2 mb-2">
      <div class="col-md-6">
        <div class="small fw-bold mb-1">4. ปัญหาและแนวทางแก้ไข</div>
        <div class="detail-text-box">${escHtml(it.k4_problem || '-')}</div>
      </div>
      <div class="col-md-6">
        <div class="small fw-bold mb-1">5. การนำไปประยุกต์ใช้</div>
        <div class="detail-text-box">${escHtml(it.k4_apply || '-')}</div>
      </div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">ลายเซ็นนักศึกษา</div>
      <div>${sigImg}</div>
    </div>
    <div class="mb-2">
      <div class="small fw-bold mb-1">ภาพถ่ายประกอบกิจกรรม</div>
      <div class="d-flex flex-wrap gap-2">${imgsHtml}</div>
    </div>
    ${it.teacher_comment ? `<div class="alert alert-light border small mt-2 mb-0"><strong>ความเห็นครู:</strong> ${escHtml(it.teacher_comment)}</div>` : ''}
  `;

  let footer = `
    <button type="button" class="btn btn-outline-primary btn-sm rounded-3" onclick="printSingleKPCH4('${escHtml(it.id)}')">
      <i class="bi bi-printer me-1"></i>พิมพ์ / Word (กพช. 4)
    </button>
    <button type="button" class="btn btn-outline-warning btn-sm rounded-3" onclick="staffPromptFixStudentId('sub', '${escHtml(it.id)}')">
      <i class="bi bi-pencil me-1"></i>แก้รหัส นศ.
    </button>
    <button type="button" class="btn btn-outline-info btn-sm rounded-3" onclick="openDoc57ModalSingle('${escHtml(it.id)}')">
      <i class="bi bi-file-earmark-check me-1"></i>บันทึก กพช. 4-6
    </button>
  `;
  if (canApprove && isWaiting) {
    footer += `
      <button type="button" class="btn btn-success btn-sm rounded-3" onclick="processSubSingle('${escHtml(it.id)}', 'APPROVE')">
        <i class="bi bi-check-lg me-1"></i>อนุมัติ
      </button>
      <button type="button" class="btn btn-danger btn-sm rounded-3" onclick="processSubSingle('${escHtml(it.id)}', 'REJECT')">
        <i class="bi bi-x-lg me-1"></i>ไม่ผ่าน
      </button>
    `;
  }
  if (canRegistrar && isWaitReg) {
    footer += `<button type="button" class="btn btn-success btn-sm rounded-3" onclick="completeRegistrarSingle('${escHtml(it.id)}')">
      <i class="bi bi-award me-1"></i>บันทึกชั่วโมงลงทะเบียน
    </button>`;
  }
  if (isAdmin) {
    footer += `<button type="button" class="btn btn-outline-danger btn-sm rounded-3" onclick="softDeleteSubUI('${escHtml(it.id)}')">
      <i class="bi bi-trash3 me-1"></i>ย้ายลงถังขยะ
    </button>`;
  }
  document.getElementById('detailSubFooter').innerHTML = footer;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal')).show();
}

// ==================== Staff Fix Student ID ====================
async function staffPromptFixStudentId(itemType, id) {
  const item = itemType === '12'
    ? DASHBOARD_DATA.requests12.find(x => x.id === id)
    : DASHBOARD_DATA.submissions.find(x => x.id === id);
  if (!item) return;

  const { value: newSid, isConfirmed } = await Swal.fire({
    title: 'แก้ไขรหัสนักศึกษา (เจ้าหน้าที่)',
    html: `<div class="small text-muted mb-2">ผู้ยื่น: <strong>${escHtml(item.student_name)}</strong> (${escHtml(item.id)})</div>`,
    input: 'text',
    inputValue: item.student_id || '',
    inputAttributes: { maxlength: 10, inputmode: 'numeric', placeholder: 'กรอกรหัสนักศึกษา 10 หลัก' },
    showCancelButton: true,
    confirmButtonText: 'บันทึกการเปลี่ยนรหัส',
    cancelButtonText: 'ยกเลิก',
    inputValidator: v => (!/^6\d{9}$/.test(String(v || '').trim()) ? 'กรุณากรอกรหัสนักศึกษา 10 หลัก (ขึ้นต้นด้วย 6)' : null)
  });
  if (!isConfirmed) return;

  const res = await callApi('staffUpdateStudentId', {
    token: CURRENT_TOKEN,
    payload: { item_type: itemType, id, new_student_id: String(newSid).trim() }
  }, true, 'กำลังอัปเดตรหัสนักศึกษา...');

  if (!res.success) {
    return Swal.fire('แก้ไขไม่สำเร็จ', res.message || '', 'error');
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById(itemType === '12' ? 'detail12Modal' : 'detailModal')).hide();
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', `อัปเดตรหัสนักศึกษาเป็น ${escHtml(newSid)} และซิงค์ข้อมูลที่เชื่อมโยงแล้ว`, 'success');
}

// ==================== Submissions Actions, Print & Doc 5-7 ====================
async function printSingleKPCH4(id) {
  const it = DASHBOARD_DATA.submissions.find(s => s.id === id);
  if (!it) return;
  const mode = await askPrintOrWordChoice('เอกสาร กพช. 4');
  if (!mode) return;
  if (mode === 'word') {
    const imgs = [];
    if (it.student_signature) imgs.push({ cid: 'sig_stu_0', url: it.student_signature });
    (it.images || []).slice(0, 4).forEach((u, pIdx) => imgs.push({ cid: `photo_0_${pIdx}`, url: getDriveDirectImgUrl(u) }));
    await downloadWordMhtml(`KPCH4_${it.student_id}`, buildKPCH4Html(it, true, 0), imgs);
  } else {
    printHtmlDocument(buildKPCH4Html(it, false, 0));
  }
}

async function printBatchKPCH4() {
  const items = getSelectedSubItems();
  if (!items.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกรายการ กพช. 4 อย่างน้อย 1 รายการ', 'warning');
  const mode = await askPrintOrWordChoice(`เอกสาร กพช. 4 (${items.length} ชุด)`);
  if (!mode) return;
  if (mode === 'word') {
    const imgs = [];
    const html = items.map((it, idx) => {
      if (it.student_signature) imgs.push({ cid: `sig_stu_${idx}`, url: it.student_signature });
      (it.images || []).slice(0, 4).forEach((u, pIdx) => imgs.push({ cid: `photo_${idx}_${pIdx}`, url: getDriveDirectImgUrl(u) }));
      return buildKPCH4Html(it, true, idx);
    }).join('');
    await downloadWordMhtml(`KPCH4_Batch_${items.length}`, html, imgs);
  } else {
    printHtmlDocument(items.map((it, idx) => buildKPCH4Html(it, false, idx)).join(''));
  }
}

async function processSubSingle(id, decision) {
  const { value: reason, isConfirmed } = await Swal.fire({
    title: decision === 'APPROVE' ? 'อนุมัติหลักฐาน กพช. 4' : 'ไม่ผ่าน / ส่งแก้ไข',
    input: 'text',
    inputLabel: decision === 'APPROVE' ? 'ความเห็นเพิ่มเติม (ถ้ามี)' : 'ระบุเหตุผล / สิ่งที่ต้องแก้ไข',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });
  if (!isConfirmed) return;
  if (decision === 'REJECT' && !String(reason || '').trim()) {
    return Swal.fire('กรุณาระบุเหตุผล', 'กรุณาระบุเหตุผลในการตีกลับ/ส่งแก้ไข', 'warning');
  }

  const res = await callApi('processApproval', {
    token: CURRENT_TOKEN,
    req_id: id,
    decision,
    reason: reason || ''
  }, true, 'กำลังบันทึกผลการตรวจ...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal')).hide();
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'บันทึกผลการตรวจสอบเรียบร้อยแล้ว', 'success');
}

async function batchApproveSubsUI() {
  const ids = getSelectedSubIds();
  if (!ids.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกรายการที่ต้องการอนุมัติ', 'warning');
  const ok = await Swal.fire({ title: `อนุมัติหลักฐาน ${ids.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'อนุมัติทั้งหมด', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('batchApproveSubmissions', { token: CURRENT_TOKEN, req_ids: ids }, true, 'กำลังอนุมัติ...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', `อนุมัติเรียบร้อย ${res.count || res.updated || ids.length} รายการ`, 'success');
}

async function batchRejectSubsUI() {
  const ids = getSelectedSubIds();
  if (!ids.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกรายการที่ต้องการส่งกลับแก้ไข', 'warning');
  const { value: reason, isConfirmed } = await Swal.fire({
    title: `ไม่ผ่าน ${ids.length} รายการ`,
    input: 'text',
    inputLabel: 'ระบุเหตุผล',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });
  if (!isConfirmed) return;
  if (!String(reason || '').trim()) return Swal.fire('กรุณาระบุเหตุผล', '', 'warning');
  const res = await callApi('batchRejectSubmissions', { token: CURRENT_TOKEN, req_ids: ids, reason: reason.trim() }, true, 'กำลังบันทึก...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'บันทึกผลเรียบร้อยแล้ว', 'success');
}

async function completeRegistrarSingle(id) {
  const ok = await Swal.fire({ title: 'ยืนยันบันทึกชั่วโมงลงทะเบียน?', icon: 'question', showCancelButton: true, confirmButtonText: 'บันทึกทะเบียน', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('markRegistrarCompleted', { token: CURRENT_TOKEN, req_ids: [id] }, true, 'กำลังบันทึกทะเบียน...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal')).hide();
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'บันทึกชั่วโมง กพช. ลงทะเบียนเรียบร้อยแล้ว', 'success');
}

async function batchCompleteRegistrarUI() {
  const ids = getSelectedSubIds();
  if (!ids.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกรายการที่ต้องการบันทึกทะเบียน', 'warning');
  const ok = await Swal.fire({ title: `บันทึกทะเบียน ${ids.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'บันทึกทั้งหมด', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('markRegistrarCompleted', { token: CURRENT_TOKEN, req_ids: ids }, true, 'กำลังบันทึกทะเบียน...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', `บันทึกทะเบียนเรียบร้อย ${res.count || res.updated || ids.length} รายการ`, 'success');
}

function exportRegistrarCSV() {
  const items = getSelectedSubItems();
  const list = items.length ? items : getFilteredSubs();
  if (!list.length) return Swal.fire('ไม่มีข้อมูล', 'ไม่พบรายการสำหรับส่งออก CSV', 'info');
  const headers = ['ID', 'StudentID', 'StudentName', 'Level', 'Term', 'Category', 'ActivityName', 'Hours', 'Teacher', 'Status'];
  const rows = list.map(s => [
    s.id, s.student_id, s.student_name, s.level, s.term_year, s.category, s.activity_name, s.hours, s.teacher_name, s.status
  ].map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(','));
  const csv = '\ufeff' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `KPCH_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ==================== Doc 5-7 (Memo KPCH 4-6) ====================
function openDoc57ModalSelected() {
  const items = getSelectedSubItems();
  if (!items.length) return Swal.fire('กรุณาเลือกรายการ', 'ติ๊กเลือกรายการ กพช. 4 อย่างน้อย 1 รายการ', 'warning');
  openDoc57ModalWithItems(items);
}

function openDoc57ModalSingle(id) {
  const it = DASHBOARD_DATA.submissions.find(s => s.id === id);
  if (!it) return;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal')).hide();
  openDoc57ModalWithItems([it]);
}

function openDoc57ModalWithItems(items) {
  DOC57_ITEMS = items || [];
  const first = DOC57_ITEMS[0] || {};
  const gdocBar = document.getElementById('d57_gdoc_bar');
  const hasTpl = DOC_TEMPLATES_READY.memo46 || (DASHBOARD_DATA.doc_templates_admin && DASHBOARD_DATA.doc_templates_admin.memo46_url);
  if (gdocBar) gdocBar.style.display = hasTpl ? 'block' : 'none';

  document.getElementById('d57_doc_no').value = 'ศธ ๐๒๑๐.๒๔๐๔/......';
  document.getElementById('d57_doc_date').value = formatThaiDate(new Date().toISOString().slice(0, 10));
  document.getElementById('d57_project_name').value = first.activity_name || '';
  document.getElementById('d57_student_count').value = DOC57_ITEMS.length;
  document.getElementById('d57_hours').value = first.hours || 0;
  document.getElementById('d57_start_date').value = formatThaiDate(first.start_date);
  document.getElementById('d57_end_date').value = formatThaiDate(first.end_date);
  document.getElementById('d57_location').value = first.location || '';
  document.getElementById('d57_advisor_name').value = first.teacher_name || (CURRENT_USER ? CURRENT_USER.full_name : '');
  document.getElementById('d57_student_list').value = DOC57_ITEMS
    .map((x, i) => `${i + 1}. ${x.student_name} (${x.student_id}) ระดับ ${x.level} — ${x.hours} ชม.`)
    .join('\n');

  bootstrap.Modal.getOrCreateInstance(document.getElementById('doc57Modal')).show();
}

function buildDoc57Html(forWord = false) {
  const docNo = document.getElementById('d57_doc_no').value.trim();
  const docDate = document.getElementById('d57_doc_date').value.trim();
  const projName = document.getElementById('d57_project_name').value.trim();
  const stCount = document.getElementById('d57_student_count').value.trim();
  const hours = document.getElementById('d57_hours').value.trim();
  const sDate = document.getElementById('d57_start_date').value.trim();
  const eDate = document.getElementById('d57_end_date').value.trim();
  const location = document.getElementById('d57_location').value.trim();
  const advisor = document.getElementById('d57_advisor_name').value.trim();
  const stListText = document.getElementById('d57_student_list').value.trim();
  const includePhotos = document.getElementById('d57_include_photos')?.checked !== false;

  const first = DOC57_ITEMS[0] || {};
  const sigLeaderHtml = renderStudentSigHtml(first.student_signature, 36, forWord ? 'sig_stu_0' : '');
  const garudaSrc = forWord ? 'cid:garuda_img' : GARUDA_URL;

  const memoHtml = `
    <div class="doc-page" style="padding: 15mm 18mm; font-family: 'TH SarabunPSK', 'Prompt', sans-serif; font-size: 16pt; color: #000; line-height: 1.35;">
      <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:10px;">
        <img src="${garudaSrc}" alt="ครุฑ" style="height:56px; width:auto;" onerror="this.style.display='none'">
        <div style="flex:1; text-align:center; font-size:22pt; font-weight:bold;">บันทึกข้อความ</div>
        <div style="width:56px;"></div>
      </div>
      <div><strong>ส่วนราชการ</strong> &nbsp; ${escHtml(SCHOOL_NAME_TH)}</div>
      <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px;">
        <div><strong>ที่</strong> &nbsp; ${escHtml(docNo)}</div>
        <div><strong>วันที่</strong> &nbsp; ${escHtml(docDate)}</div>
      </div>
      <div style="border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 12px;">
        <strong>เรื่อง</strong> &nbsp; รายงานผลการดำเนินกิจกรรมพัฒนาคุณภาพชีวิต (กพช. 4-6)
      </div>
      <div style="margin-bottom: 10px;"><strong>เรียน</strong> &nbsp; ผู้อำนวยการ${escHtml(SCHOOL_NAME_TH)}</div>

      <p style="text-indent: 2.5cm; text-align: justify; margin-bottom: 8px;">
        ตามที่ได้รับอนุมัติให้นักศึกษา ${escHtml(SCHOOL_NAME_TH)} จำนวน ${escHtml(toThaiDigits(stCount))} คน ดำเนินโครงการ/กิจกรรมพัฒนาคุณภาพชีวิต (กพช.)
        เรื่อง <strong>${escHtml(projName)}</strong> จำนวน ${escHtml(toThaiDigits(hours))} ชั่วโมง ระหว่างวันที่ ${escHtml(toThaiDigits(sDate))} ถึงวันที่ ${escHtml(toThaiDigits(eDate))}
        ณ ${escHtml(location)} โดยมี ${escHtml(advisor)} เป็นครูที่ปรึกษา นั้น
      </p>
      <p style="text-indent: 2.5cm; text-align: justify; margin-bottom: 8px;">
        บัดนี้ นักศึกษาได้ปฏิบัติกิจกรรมดังกล่าวเสร็จสิ้นเรียบร้อยแล้ว จึงขอส่งรายงานผลการปฏิบัติกิจกรรมและรับรองชั่วโมง กพช. ตามรายชื่อดังต่อไปนี้:
      </p>
      <div style="margin-left: 1.5cm; white-space: pre-wrap; margin-bottom: 14px; font-size: 15pt;">${escHtml(stListText)}</div>
      <p style="text-indent: 2.5cm; margin-bottom: 18px;">จึงเรียนมาเพื่อโปรดพิจารณารับรองผลการทำกิจกรรมและบันทึกชั่วโมง กพช. ต่อไป</p>

      <table style="width:100%; border:none; margin-top: 12px;">
        <tr>
          <td style="width:50%; text-align:center; vertical-align:bottom;">
            ${sigLeaderHtml || '<div style="height:34px;"></div>'}
            <div>ลงชื่อ .................................................... ผู้รายงาน</div>
            <div>( ${escHtml(first.student_name || '............................................')} )</div>
            <div>ตัวแทนนักศึกษา</div>
          </td>
          <td style="width:50%; text-align:center; vertical-align:bottom;">
            <div style="height:34px;"></div>
            <div>ลงชื่อ .................................................... ผู้รับรอง</div>
            <div>( ${escHtml(advisor)} )</div>
            <div>ครูที่ปรึกษา</div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 24px; text-align: center;">
        <div style="font-weight:bold; margin-bottom: 16px;">ความเห็นผู้อำนวยการ &nbsp;&nbsp; ☐ รับรองผล &nbsp;&nbsp;&nbsp; ☐ มอบหมายงานทะเบียนบันทึกชั่วโมง</div>
        <div>ลงชื่อ ....................................................</div>
        <div>( .................................................... )</div>
        <div>ผู้อำนวยการ${escHtml(SCHOOL_NAME_TH)}</div>
      </div>
    </div>
  `;

  const k5Html = buildKPCH5Html(DOC57_ITEMS);
  const k4Pages = DOC57_ITEMS.map((it, idx) => {
    const clone = includePhotos ? it : { ...it, images: [] };
    return buildKPCH4Html(clone, forWord, idx);
  }).join('');

  return memoHtml + k5Html + k4Pages;
}

async function executeOutputDoc57(mode) {
  const includePhotos = document.getElementById('d57_include_photos')?.checked !== false;
  if (mode === 'word') {
    const imgs = [{ cid: 'garuda_img', url: GARUDA_URL }];
    DOC57_ITEMS.forEach((it, idx) => {
      if (it.student_signature) imgs.push({ cid: `sig_stu_${idx}`, url: it.student_signature });
      if (includePhotos) {
        (it.images || []).slice(0, 4).forEach((u, pIdx) => {
          imgs.push({ cid: `photo_${idx}_${pIdx}`, url: getDriveDirectImgUrl(u) });
        });
      }
    });
    await downloadWordMhtml('Memo_KPCH4_6', buildDoc57Html(true), imgs);
  } else {
    printHtmlDocument(buildDoc57Html(false));
  }
}

// ==================== Admin Panels & CRUD ====================
function switchAdminTab(tab) {
  ACTIVE_ADMIN_TAB = tab;
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-admin-tab') === tab);
  });

  const viewMap = {
    subs: 'dashSubsView',
    req12: 'dashReq12View',
    categories: 'adminCategoriesView',
    users: 'adminUsersView',
    ann: 'adminAnnView',
    maint: 'adminMaintView',
    logs: 'adminLogsView',
    trash: 'adminTrashView'
  };
  showOnlyDashView(viewMap[tab] || 'dashSubsView');

  const titles = {
    subs: ['ผู้ดูแลระบบ : หลักฐาน กพช. 4', 'จัดการและตรวจสอบหลักฐานผลการทำกิจกรรมทั้งหมด'],
    req12: ['ผู้ดูแลระบบ : คำขอ กพช. 1-2', 'จัดการคำขอทำกิจกรรมล่วงหน้าทั้งหมด'],
    categories: ['จัดการประเภทกิจกรรม กพช.', 'เพิ่ม แก้ไข หรือปิดการใช้งานประเภทกิจกรรม'],
    users: ['จัดการผู้ใช้งานระบบ', 'เพิ่ม/แก้ไขบัญชีครูที่ปรึกษา งานทะเบียน และผู้ดูแลระบบ'],
    ann: ['ประกาศ & ตั้งค่าฟอร์ม Google Docs', 'จัดการประกาศหน้าเว็บและเชื่อมต่อแม่แบบ Google Docs'],
    maint: ['เปิด-ปิดโหมดปรับปรุงระบบ', 'ควบคุมการเข้าถึงระบบแบบเรียลไทม์'],
    logs: ['ประวัติการใช้งานระบบ (Logs)', 'ตรวจสอบกิจกรรมและรายการแก้ไขล่าสุด'],
    trash: ['ถังขยะและกู้คืนข้อมูล', 'กู้คืนรายการที่ลบหรือลบถาวร']
  };
  const info = titles[tab] || titles.subs;
  document.getElementById('desktopPageTitle').textContent = info[0];
  document.getElementById('desktopPageSubtitle').textContent = info[1];
  renderAdminPanels();
}

function renderAdminPanels() {
  // Categories
  const catBody = document.getElementById('catTableBody');
  if (catBody) {
    catBody.innerHTML = (DASHBOARD_DATA.categories || []).map(c => {
      const cid = c.cat_id || c.id || '';
      const cname = c.cat_name || c.name || '';
      const active = c.status ? c.status === 'ACTIVE' : c.is_active !== false;
      return `<tr>
        <td class="fw-semibold">${escHtml(cname)}</td>
        <td>${active ? '<span class="badge bg-success">เปิดใช้</span>' : '<span class="badge bg-secondary">ปิด</span>'}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick="toggleCategoryUI('${escHtml(cid)}', ${!active})">สลับสถานะ</button>
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteCategoryUI('${escHtml(cid)}')">ลบ</button>
        </td>
      </tr>`;
    }).join('');
  }

  // Users
  const uBody = document.getElementById('usersTableBody');
  if (uBody) {
    uBody.innerHTML = (DASHBOARD_DATA.users || []).map(u => {
      const active = u.status ? u.status === 'ACTIVE' : u.is_active !== false;
      return `<tr>
        <td class="fw-semibold">${escHtml(u.username)}</td>
        <td>${escHtml(u.full_name)}</td>
        <td><span class="badge bg-indigo-soft">${escHtml(u.role)}</span></td>
        <td>${escHtml(u.group_name || '-')}</td>
        <td>${active ? '<span class="badge bg-success">ใช้งาน</span>' : '<span class="badge bg-secondary">ปิด</span>'}</td>
        <td class="text-end">
          <button type="button" class="btn btn-outline-primary btn-sm" onclick="openUserModal('${escHtml(u.user_id)}')">แก้ไข</button>
        </td>
      </tr>`;
    }).join('');
  }

  // Announcement & Google Docs
  const annInput = document.getElementById('annEditInput');
  if (annInput && !annInput.matches(':focus')) {
    annInput.value = extractAnnouncementText(DASHBOARD_DATA.announcement) || document.getElementById('annDashText')?.textContent || '';
  }
  const tpl = DASHBOARD_DATA.doc_templates_admin;
  if (tpl) {
    const u56 = document.getElementById('tpl_memo56_url');
    const u46 = document.getElementById('tpl_memo46_url');
    if (u56 && !u56.matches(':focus')) u56.value = tpl.memo56_url || '';
    if (u46 && !u46.matches(':focus')) u46.value = tpl.memo46_url || '';
    const s56 = document.getElementById('tpl_memo56_status');
    const s46 = document.getElementById('tpl_memo46_status');
    if (s56) s56.innerHTML = tpl.memo56_id ? `<span class="text-success">เชื่อมต่อแล้ว: ${escHtml(tpl.memo56_name || tpl.memo56_id)}</span>` : '<span class="text-muted">ยังไม่ได้เชื่อมต่อ</span>';
    if (s46) s46.innerHTML = tpl.memo46_id ? `<span class="text-success">เชื่อมต่อแล้ว: ${escHtml(tpl.memo46_name || tpl.memo46_id)}</span>` : '<span class="text-muted">ยังไม่ได้เชื่อมต่อ</span>';
  }

  // Maintenance
  const m = DASHBOARD_DATA.maintenance;
  if (m) {
    document.getElementById('maint_enabled').checked = !!m.enabled;
    document.getElementById('maint_title').value = m.title || '';
    document.getElementById('maint_message').value = m.message || '';
    document.getElementById('maint_eta').value = m.eta || '';
    document.getElementById('maint_last_updated').textContent = m.updated_at ? `${m.updated_at} (${m.updated_by || '-'})` : '-';
  }

  // Logs
  const lBody = document.getElementById('logsTableBody');
  if (lBody) {
    lBody.innerHTML = (DASHBOARD_DATA.logs || []).slice(0, 120).map(l => `
      <tr>
        <td class="text-nowrap">${escHtml(l.timestamp || l.created_at || '-')}</td>
        <td>${escHtml(l.actor || l.actor_name || '-')}</td>
        <td><span class="badge bg-light text-dark border">${escHtml(l.action || '-')}</span></td>
        <td>${escHtml(l.detail || '-')}</td>
      </tr>
    `).join('');
  }

  // Trash
  const t12 = document.getElementById('trash12TableBody');
  if (t12) {
    t12.innerHTML = (DASHBOARD_DATA.trash12 || []).map(x => `
      <tr>
        <td>${escHtml(x.id)}</td>
        <td>${escHtml(x.student_id)} ${escHtml(x.student_name)}</td>
        <td>${escHtml(x.activity_name)}</td>
        <td>${escHtml(x.deleted_by || '-')}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-success btn-sm" onclick="restoreTrashUI('12', '${escHtml(x.id)}')">กู้คืน</button>
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="permDeleteTrashUI('12', '${escHtml(x.id)}')">ลบถาวร</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted py-3">ถังขยะว่างเปล่า</td></tr>';
  }
  const tSub = document.getElementById('trashSubsTableBody');
  if (tSub) {
    tSub.innerHTML = (DASHBOARD_DATA.trashSubs || []).map(x => `
      <tr>
        <td>${escHtml(x.id)}</td>
        <td>${escHtml(x.student_id)} ${escHtml(x.student_name)}</td>
        <td>${escHtml(x.activity_name)}</td>
        <td>${escHtml(x.deleted_by || '-')}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-success btn-sm" onclick="restoreTrashUI('SUB', '${escHtml(x.id)}')">กู้คืน</button>
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="permDeleteTrashUI('SUB', '${escHtml(x.id)}')">ลบถาวร</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted py-3">ถังขยะว่างเปล่า</td></tr>';
  }
}

async function addCategoryUI() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return;
  const res = await callApi('saveCategoryAdmin', { token: CURRENT_TOKEN, category_data: { cat_name: name, status: 'ACTIVE' } }, true);
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  document.getElementById('newCatName').value = '';
  await loadDashboardData(true);
  loadPublicData();
}

async function toggleCategoryUI(id, active) {
  const cat = (DASHBOARD_DATA.categories || []).find(c => (c.cat_id || c.id) === id);
  if (!cat) return;
  const res = await callApi('saveCategoryAdmin', {
    token: CURRENT_TOKEN,
    category_data: {
      cat_id: id,
      cat_name: cat.cat_name || cat.name,
      default_project: cat.default_project || '',
      default_hours: cat.default_hours || 25,
      default_rationale: cat.default_rationale || '',
      status: active ? 'ACTIVE' : 'INACTIVE'
    }
  }, true);
  if (res.success) {
    await loadDashboardData(true);
    loadPublicData();
  }
}

async function deleteCategoryUI(id) {
  const ok = await Swal.fire({ title: 'ยืนยันลบประเภทกิจกรรม?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('deleteCategoryAdmin', { token: CURRENT_TOKEN, cat_id: id }, true);
  if (res.success) {
    await loadDashboardData(true);
    loadPublicData();
  }
}

function openUserModal(userId = '') {
  const u = (DASHBOARD_DATA.users || []).find(x => x.user_id === userId);
  document.getElementById('userModalTitle').textContent = u ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่';
  document.getElementById('u_id').value = u ? u.user_id : '';
  document.getElementById('u_username').value = u ? u.username : '';
  document.getElementById('u_password').value = '';
  document.getElementById('u_fullname').value = u ? u.full_name : '';
  document.getElementById('u_role').value = u ? u.role : 'TEACHER';
  document.getElementById('u_group').value = u ? (u.group_name || '') : '';
  document.getElementById('u_active').checked = u ? (u.status ? u.status === 'ACTIVE' : u.is_active !== false) : true;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show();
}

async function handleSaveUser(e) {
  e.preventDefault();
  const payload = {
    user_id: document.getElementById('u_id').value,
    username: document.getElementById('u_username').value.trim(),
    new_password: document.getElementById('u_password').value,
    full_name: document.getElementById('u_fullname').value.trim(),
    role: document.getElementById('u_role').value,
    group_name: document.getElementById('u_group').value.trim(),
    status: document.getElementById('u_active').checked ? 'ACTIVE' : 'INACTIVE'
  };
  const res = await callApi('saveUserAdmin', { token: CURRENT_TOKEN, user_data: payload }, true, 'กำลังบันทึกผู้ใช้...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide();
  await loadDashboardData(true);
  loadPublicData();
  Swal.fire('สำเร็จ', 'บันทึกข้อมูลผู้ใช้งานแล้ว', 'success');
}

async function saveAnnouncementUI() {
  const text = document.getElementById('annEditInput').value.trim();
  const res = await callApi('saveAnnouncement', {
    token: CURRENT_TOKEN,
    announcement: { visible: !!text, badge: '', content: text }
  }, true, 'กำลังบันทึกประกาศ...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'อัปเดตข้อความประกาศเรียบร้อยแล้ว', 'success');
}

async function saveDocTemplatesUI() {
  const templates = {
    memo56_url: document.getElementById('tpl_memo56_url').value.trim(),
    memo46_url: document.getElementById('tpl_memo46_url').value.trim()
  };
  const res = await callApi('saveDocTemplates', { token: CURRENT_TOKEN, templates }, true, 'กำลังตรวจสอบสิทธิ์ Google Docs...');
  if (!res.success) return Swal.fire('เชื่อมต่อไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'บันทึกและตรวจสอบสิทธิ์ Google Docs เรียบร้อยแล้ว', 'success');
}

async function saveMaintenanceUI() {
  const maintenance = {
    enabled: document.getElementById('maint_enabled').checked,
    title: document.getElementById('maint_title').value.trim(),
    message: document.getElementById('maint_message').value.trim(),
    eta: document.getElementById('maint_eta').value.trim()
  };
  const res = await callApi('saveMaintenance', { token: CURRENT_TOKEN, maintenance }, true, 'กำลังบันทึกโหมดปรับปรุงระบบ...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', maintenance.enabled ? 'เปิดโหมดปิดปรับปรุงระบบแล้ว' : 'ปิดโหมดปรับปรุงและเปิดระบบให้ใช้งานแล้ว', 'success');
}

async function softDelete12UI(id) {
  const ok = await Swal.fire({ title: 'ย้ายคำขอ กพช. 1-2 ลงถังขยะ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ย้ายลงถังขยะ', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('deleteApprovals12', { token: CURRENT_TOKEN, req12_ids: [id] }, true);
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detail12Modal')).hide();
  await loadDashboardData(true);
}

async function softDeleteSubUI(id) {
  const ok = await Swal.fire({ title: 'ย้ายหลักฐาน กพช. 4 ลงถังขยะ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ย้ายลงถังขยะ', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('deleteSubmissions', { token: CURRENT_TOKEN, req_ids: [id] }, true);
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal')).hide();
  await loadDashboardData(true);
}

async function restoreTrashUI(type, id) {
  const res = await callApi('restoreTrash', { token: CURRENT_TOKEN, trash_type: type === '12' ? '12' : 'SUB', item_id: id }, true, 'กำลังกู้คืนข้อมูล...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
  Swal.fire('สำเร็จ', 'กู้คืนข้อมูลเรียบร้อยแล้ว', 'success');
}

async function permDeleteTrashUI(type, id) {
  const ok = await Swal.fire({ title: 'ลบข้อมูลถาวร?', text: 'ไม่สามารถกู้คืนได้อีก', icon: 'error', showCancelButton: true, confirmButtonText: 'ลบถาวร', cancelButtonText: 'ยกเลิก' });
  if (!ok.isConfirmed) return;
  const res = await callApi('purgeTrash', { token: CURRENT_TOKEN, trash_type: type === '12' ? '12' : 'SUB', item_id: id }, true, 'กำลังลบถาวร...');
  if (!res.success) return Swal.fire('ไม่สำเร็จ', res.message || '', 'error');
  await loadDashboardData(true);
}

// ==================== App Bootstrap ====================
async function initApp() {
  renderNavbar();
  initSignaturePad('p12_sig_canvas');
  startMaintenanceSync();
  await loadPublicData();

  if (CURRENT_TOKEN) {
    const res = await callApi('getDashboard', { token: CURRENT_TOKEN }, false);
    if (res && res.success) {
      CURRENT_USER = res.user;
      await enterDashboardMode();
    } else {
      CURRENT_TOKEN = '';
      localStorage.removeItem('kpch_token');
      renderNavbar();
    }
  }
}

document.addEventListener('DOMContentLoaded', initApp);
