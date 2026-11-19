const API_URL = 'https://script.google.com/macros/s/AKfycbwuuQeFT7Ikjcr4GeTrwdY_7I4hJ-Ksgs4dWWYV1us8lOe02233vtOgv0TTyPwgM9Vu/exec';
const SCHOOL_NAME = 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง';
const DIRECTOR_NAME = 'นางทัศดาพร ลองชัย';
const COMM_1_NAME = 'นายเกียรติศักดิ์  หมั่นอุตส่าห์';
const COMM_2_NAME = 'นายไชยพัฒน์  นัยเนตร';
const COMM_3_NAME = 'นางสาวนิศารัตน์  ดอนปัญญาไพร';
const GARUDA_URL = 'garuda.png';

const EVAL_QUESTIONS_12 = [
  'ท่านคิดว่า กิจกรรม กพช. มีประโยชน์เพียงใด',
  'ท่านได้รับความรู้เกี่ยวกับโครงสร้างและประโยชน์ของ กพช. ระดับใด',
  'ท่านมีความรู้ในเรื่องแนวทางการพัฒนาตนเอง ครอบครัว ชุมชน สังคมในระดับใด',
  'ท่านได้รับความรู้เกี่ยวกับกระบวนการกลุ่มในระดับใด',
  'ท่านได้รับความรู้ในเรื่องกระบวนการคิดเป็น ทำเป็น แก้ปัญหาเป็น และการนำไปใช้ในการดำเนินชีวิตในระดับใด',
  'ท่านได้รับความรู้ในเรื่องการประสานเครือข่ายในระดับใด',
  'ท่านได้รับความรู้ในเรื่องการเป็นผู้นำผู้ตามในระดับใด',
  'ท่านมีความรู้ในเรื่องการวางแผน และประโยชน์ของการวางแผนในระดับใด',
  'ท่านมีความรู้ในเรื่องมนุษยสัมพันธ์ในระดับใด',
  'ท่านได้รับความรู้ในเรื่องการเขียนโครงการในระดับใด'
];

let compressedImages = [];
let editCompressedImages = [];
let authToken = null;
let currentUser = null;
let dashItems = [];
let dash12Items = [];
let adminUsers = [];
let adminLogs = [];
let adminTrashSubs = [];
let adminTrash12 = [];
let publicTeachersList = [];
let kpchCategories = [];
let registrarName = '';
let filterMode = 'PENDING';
let filter12Mode = 'PENDING';
let teacherTabMode = 'sub';
let currentEligibleList12 = [];
let currentFilteredSubs = [];
let currentFiltered12 = [];
let lastStatus12List = [];
let lastStatusSubList = [];
let _doc56Items = [];
let _doc57TargetIds = [];
let _garudaDataUrlCache = null;

// 3 ขั้นตอน: นักศึกษา -> ครูประจำกลุ่ม -> นายทะเบียน
const STEP_LABELS = {
  'WAIT_TEACHER': { text: 'รอครูประจำกลุ่มอนุมัติ', cls: 'bg-warning text-dark' },
  'APPROVED_FOR_REGISTRAR': { text: 'ครูอนุมัติแล้ว (ส่งนายทะเบียน)', cls: 'bg-success text-white' },
  'COMPLETED': { text: 'นายทะเบียนบันทึกเรียบร้อย', cls: 'bg-dark text-white' },
  'REJECTED': { text: 'ถูกตีกลับให้แก้ไข', cls: 'bg-danger text-white' }
};

const STEP12_LABELS = {
  'WAIT_TEACHER_12': { text: 'รอครูอนุมัติ กพช.1-2', cls: 'bg-warning text-dark' },
  'APPROVED_12': { text: 'อนุมัติ กพช.1-2 แล้ว', cls: 'bg-success text-white' },
  'REJECTED_12': { text: 'ถูกตีกลับให้แก้ไข กพช.1-2', cls: 'bg-danger text-white' }
};

const ROLE_LABELS = {
  'TEACHER': 'ครูประจำกลุ่ม',
  'REGISTRAR': 'นายทะเบียน',
  'ADMIN': 'ผู้ดูแลระบบ (Admin)'
};

// ==================== เชื่อมต่อ API ====================
async function callApi(action, params = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...params })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
  return json.data;
}

// ==================== Helpers ====================
function showLoading(msg) {
  document.getElementById('loadingText').innerText = msg || 'กำลังดำเนินการ...';
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escJs(str) {
  if (str === null || str === undefined) return '';
  return esc(String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
}
function validateStudentId10(sid) {
  return /^6\d{9}$/.test(String(sid || '').trim());
}
function getDriveThumb(url) {
  if (!url) return '';
  const m = String(url).match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/thumbnail?id=${m[0]}&sz=w800` : url;
}
function waitForPrintImages(container, maxWaitMs = 2500) {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  const promises = imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  });
  return Promise.race([
    Promise.all(promises),
    new Promise(resolve => setTimeout(resolve, maxWaitMs))
  ]);
}
async function triggerPrint() {
  const container = document.getElementById('printOnlyContainer');
  await waitForPrintImages(container);
  setTimeout(() => window.print(), 150);
}

// ==================== ระบบเลือก พิมพ์ / ดาวน์โหลดไฟล์ Word (.doc) ====================
async function getGarudaForWord() {
  if (_garudaDataUrlCache) return _garudaDataUrlCache;
  try {
    const res = await fetch(GARUDA_URL);
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
        _garudaDataUrlCache = dataUrl;
        return dataUrl;
      }
    }
  } catch (e) {}
  try {
    return new URL(GARUDA_URL, window.location.href).href;
  } catch (e) {
    return GARUDA_URL;
  }
}

function encodeQuotedPrintable(str) {
  const bytes = new TextEncoder().encode(str);
  let out = '';
  let lineLen = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 13) continue;
    if (b === 10) {
      out += '\r\n';
      lineLen = 0;
      continue;
    }
    let token;
    if ((b >= 33 && b <= 60) || (b >= 62 && b <= 126) || b === 9 || b === 32) {
      if ((b === 32 || b === 9) && (i + 1 >= bytes.length || bytes[i + 1] === 10 || bytes[i + 1] === 13)) {
        token = '=' + b.toString(16).toUpperCase().padStart(2, '0');
      } else {
        token = String.fromCharCode(b);
      }
    } else {
      token = '=' + b.toString(16).toUpperCase().padStart(2, '0');
    }
    if (lineLen + token.length > 74) {
      out += '=\r\n';
      lineLen = 0;
    }
    out += token;
    lineLen += token.length;
  }
  return out;
}

function buildWordHtmlEnvelope(bodyHtml) {
  return `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  @page WordSection1 {
    size: 21.0cm 29.7cm;
    margin: 1.5cm 2.0cm 1.5cm 2.0cm;
    mso-header-margin: 1.0cm;
    mso-footer-margin: 1.0cm;
    mso-paper-source: 0;
  }
  div.WordSection1 { page: WordSection1; }
  body, div, p, span, td, th, li, b, strong, u {
    font-family: 'TH SarabunPSK', 'TH Sarabun New', 'Sarabun', sans-serif;
  }
  body {
    font-size: 16pt;
    line-height: 1.35;
    color: #000000;
    margin: 0;
    padding: 0;
  }
  p { margin: 0 0 4pt 0; }
  table { border-collapse: collapse; }
  .memo-field { margin-bottom: 3pt; font-size: 16pt; }
  .memo-divider { border-top: 1.5pt solid #000000; margin: 6pt 0 10pt 0; font-size: 1pt; line-height: 1pt; }
  .memo-indent { text-indent: 2.5cm; text-align: justify; margin-bottom: 8pt; font-size: 16pt; }
  .doc-title-center {
    text-align: center;
    font-weight: bold;
    font-size: 18pt;
    line-height: 1.3;
    margin-bottom: 6pt;
  }
  .doc-section-indent {
    margin-left: 1.2cm;
    text-align: justify;
  }
  .doc-table, .batch-table {
    width: 100%;
    border-collapse: collapse;
    margin: 6pt 0;
    font-size: 14pt;
  }
  .doc-table th, .doc-table td,
  .batch-table th, .batch-table td {
    border: 1pt solid #000000;
    padding: 4pt 6pt;
    vertical-align: middle;
  }
  .doc-table th, .batch-table th {
    background-color: #f1f5f9;
    text-align: center;
    font-weight: bold;
  }
  .sig-center {
    text-align: center;
    margin-top: 14pt;
  }
</style>
</head>
<body>
<div class="WordSection1">
${bodyHtml}
</div>
</body>
</html>`;
}

function exportHtmlToWord(filename, bodyHtml) {
  const fullHtml = buildWordHtmlEnvelope(bodyHtml);
  const embeddedImages = [];
  const processedHtml = fullHtml.replace(
    /src="(data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+))"/gi,
    (match, _fullUri, mime, b64) => {
      const idx = embeddedImages.length;
      const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
      const loc = `file:///C:/kpch_doc/image_${idx}.${ext}`;
      embeddedImages.push({ loc, mime, b64: b64.replace(/\s+/g, '') });
      return `src="${loc}"`;
    }
  );

  let blob;
  if (embeddedImages.length > 0) {
    const boundary = '----=_NextPart_KPCH_WORD_DOC';
    const parts = [
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Location: file:///C:/kpch_doc/document.htm',
      'Content-Transfer-Encoding: quoted-printable',
      'Content-Type: text/html; charset="utf-8"',
      '',
      encodeQuotedPrintable(processedHtml),
      ''
    ];
    embeddedImages.forEach(img => {
      const wrappedB64 = img.b64.replace(/(.{76})/g, '$1\r\n');
      parts.push(`--${boundary}`);
      parts.push(`Content-Location: ${img.loc}`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(`Content-Type: ${img.mime}`);
      parts.push('');
      parts.push(wrappedB64);
      parts.push('');
    });
    parts.push(`--${boundary}--`);
    blob = new Blob([parts.join('\r\n')], { type: 'application/msword' });
  } else {
    blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword;charset=utf-8' });
  }

  const safeName = String(filename || 'document').replace(/[\\/:*?"<>|]/g, '_');
  const finalName = safeName.toLowerCase().endsWith('.doc') ? safeName : `${safeName}.doc`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function choosePrintOrWord(docTitle, onPrint, onWord) {
  Swal.fire({
    title: 'เลือกรูปแบบเอกสาร',
    html: `<div class="fw-semibold text-primary mb-2">${esc(docTitle)}</div><div class="small text-muted">สามารถ <b>สั่งปริ้นทันที</b> หรือ <b>ดาวน์โหลดเป็นไฟล์ Word (.doc)</b> เพื่อปรับแก้ข้อความในบางบรรทัดได้</div>`,
    icon: 'question',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: '<i class="bi bi-printer me-1"></i> สั่งปริ้นทันที',
    denyButtonText: '<i class="bi bi-file-earmark-word me-1"></i> ดาวน์โหลด Word (.doc)',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#4f46e5',
    denyButtonColor: '#0d9488'
  }).then(res => {
    if (res.isConfirmed && typeof onPrint === 'function') onPrint();
    else if (res.isDenied && typeof onWord === 'function') onWord();
  });
}

function wordBoxTagHtml(label) {
  return `<table style="width:100%; border:none; margin-bottom:4pt;"><tr><td style="border:none;"></td><td style="width:82pt; border:1.5pt solid #000000; text-align:center; font-weight:bold; font-size:16pt; padding:2pt 8pt;">${esc(label)}</td></tr></table>`;
}

function wordLineFill(val, emptyDots = '........................................') {
  const clean = esc(val);
  return clean ? `&nbsp;<u>&nbsp;&nbsp;${clean}&nbsp;&nbsp;</u>&nbsp;` : `&nbsp;${emptyDots}&nbsp;`;
}

function wordPageBreak() {
  return '<br clear="all" style="page-break-before:always; mso-break-type:page-break" />';
}

function syncCheckPair(cb, cls) {
  document.querySelectorAll(`.${cls}`).forEach(el => {
    if (el !== cb && el.value === cb.value) el.checked = cb.checked;
  });
}
function getCheckedUniqueIds(cls) {
  const all = Array.from(document.querySelectorAll(`.${cls}:checked`));
  const visible = all.filter(cb => cb.offsetParent !== null);
  const source = visible.length > 0 ? visible : all;
  return Array.from(new Set(source.map(cb => cb.value)));
}
function formatThaiDate(dateInput) {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (!dateInput) {
    const d = new Date();
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  const parts = String(dateInput).split(' ')[0].split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && months[m]) return `${d} ${months[m]} ${y < 2400 ? y + 543 : y}`;
  }
  return String(dateInput);
}
function formatThaiDateWithLabel(dateInput) {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (!dateInput) return '......เดือน............พ.ศ.........';
  const parts = String(dateInput).split(' ')[0].split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && months[m]) return `${d} เดือน ${months[m]} พ.ศ. ${y < 2400 ? y + 543 : y}`;
  }
  return String(dateInput);
}
function formatShortThaiDate(dateInput) {
  if (!dateInput) return '-';
  const shortMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const datePart = String(dateInput).split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && shortMonths[m]) return `${d} ${shortMonths[m]} ${y < 2400 ? y + 543 : y}`;
  }
  return datePart;
}
function parseTermParts(termVal) {
  const raw = String(termVal || '').replace(/^'/, '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const p = raw.split(' ')[0].split('-');
    const y = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return { no: String(m), year: String(y < 2400 ? y + 543 : y) };
  }
  if (raw.includes('/')) {
    const p = raw.split('/');
    return { no: p[0].trim() || '....', year: p[1].trim() || '........' };
  }
  return { no: raw || '....', year: '........' };
}
function formatTermText(termVal) {
  const t = parseTermParts(termVal);
  return `${t.no}/${t.year}`;
}
function getItemTerm(item) {
  if (item.term) return formatTermText(item.term);
  if (item.ref_12_id && dash12Items.length > 0) {
    const ref12 = dash12Items.find(x => x.req12_id === item.ref_12_id);
    if (ref12 && ref12.term) return formatTermText(ref12.term);
  }
  const rawDate = String(item.activity_date || item.created_at || '').split(' ')[0];
  const m = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1], 10), mo = parseInt(m[2], 10);
    const thaiYear = y < 2400 ? y + 543 : y;
    if (mo >= 5 && mo <= 10) return `1/${thaiYear}`;
    if (mo >= 11) return `2/${thaiYear}`;
    return `2/${thaiYear - 1}`;
  }
  return '';
}
function matchesTermFilter(itemTerm, filterVal) {
  if (!filterVal || filterVal === 'ALL') return true;
  if (filterVal.startsWith('TERM:')) return itemTerm === filterVal.slice(5);
  if (filterVal.startsWith('YEAR:')) return String(itemTerm || '').split('/')[1] === filterVal.slice(5);
  return true;
}
function populateTermDropdown(selectEl, items, termGetter) {
  if (!selectEl) return;
  const prev = selectEl.value || 'ALL';
  const termSet = new Set(), yearSet = new Set();
  items.forEach(it => {
    const t = termGetter(it);
    if (t && t.includes('/')) {
      termSet.add(t);
      const y = t.split('/')[1];
      if (y && /^\d{4}$/.test(y)) yearSet.add(y);
    }
  });
  const terms = Array.from(termSet).sort((a, b) => {
    const [ta, ya] = a.split('/').map(Number), [tb, yb] = b.split('/').map(Number);
    return yb !== ya ? yb - ya : tb - ta;
  });
  const years = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  let html = '<option value="ALL">📅 ทุกภาคเรียน</option>';
  if (terms.length > 0) html += '<optgroup label="เลือกตามภาคเรียน">' + terms.map(t => `<option value="TERM:${esc(t)}">ภาคเรียนที่ ${esc(t)}</option>`).join('') + '</optgroup>';
  if (years.length > 0) html += '<optgroup label="รวมทั้งปีการศึกษา">' + years.map(y => `<option value="YEAR:${esc(y)}">รวมปีการศึกษา ${esc(y)}</option>`).join('') + '</optgroup>';
  selectEl.innerHTML = html;
  selectEl.value = Array.from(selectEl.options).some(o => o.value === prev) ? prev : 'ALL';
}
function populateDashTeacherFilter() {
  const sel = document.getElementById('dashTeacherFilter');
  if (!sel) return;
  const prev = sel.value || 'ALL';
  const tSet = new Set();
  dashItems.forEach(it => { if (it.teacher_name) tSet.add(String(it.teacher_name).trim()); });
  const teachers = Array.from(tSet).sort((a, b) => a.localeCompare(b, 'th'));
  sel.innerHTML = '<option value="ALL">👩‍🏫 ครูประจำกลุ่มทั้งหมด</option>' + teachers.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  sel.value = Array.from(sel.options).some(o => o.value === prev) ? prev : 'ALL';
}
function toInputDate(val) {
  return val ? String(val).split(' ')[0] : '';
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function safeAlert(title, htmlText, icon) {
  Swal.fire({ title, html: htmlText, icon: icon || 'info', confirmButtonColor: '#6366f1' });
}
function openModalById(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}
function closeModalById(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).hide();
}
function renderNavbar() {
  const area = document.getElementById('navUserArea');
  if (!area) return;
  if (currentUser) {
    area.innerHTML = `
      <span class="text-white small">
        <i class="bi bi-person-circle me-1"></i>${esc(currentUser.full_name)}
        <span class="badge bg-warning text-dark rounded-pill ms-1">${ROLE_LABELS[currentUser.role] || currentUser.role}</span>
      </span>
      <button type="button" class="btn btn-outline-light btn-sm rounded-pill px-3" onclick="handleLogout()"><i class="bi bi-box-arrow-right me-1"></i>ออก</button>`;
  } else {
    area.innerHTML = `<button type="button" class="btn btn-light btn-sm rounded-pill px-3 fw-bold text-primary shadow-sm" onclick="openModalById('loginModal')"><i class="bi bi-box-arrow-in-right me-1"></i>เข้าสู่ระบบเจ้าหน้าที่</button>`;
  }
}

// ==================== ประเภท กพช. ====================
function populateCategorySelects() {
  const activeCats = kpchCategories.filter(c => c.status !== 'INACTIVE');
  const studentOpts = '<option value="">-- เลือกประเภท กพช. --</option>' + activeCats.map(c => `<option value="${esc(c.cat_name)}">${esc(c.cat_name)}</option>`).join('');
  const filterOpts = '<option value="ALL">🏷️ ทุกประเภท กพช.</option>' + kpchCategories.map(c => `<option value="${esc(c.cat_name)}">${esc(c.cat_name)}</option>`).join('');

  ['p12_category', 'f_category', 'se_category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const prev = el.value; el.innerHTML = studentOpts; if (prev && Array.from(el.options).some(o => o.value === prev)) el.value = prev; }
  });
  ['dashCategoryFilter', 'dash12CategoryFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const prev = el.value; el.innerHTML = filterOpts; if (Array.from(el.options).some(o => o.value === prev)) el.value = prev; }
  });
}

function onSelectKpchCategory(prefix) {
  const catName = document.getElementById(`${prefix}_category`)?.value;
  const cat = kpchCategories.find(c => c.cat_name === catName);
  if (!cat) return;
  const actEl = document.getElementById(`${prefix}_activity_name`);
  if (actEl && !actEl.value && cat.default_project) actEl.value = cat.default_project;
  if (prefix === 'f') {
    const hrsEl = document.getElementById('f_hours');
    if (hrsEl && !hrsEl.value && cat.default_hours) hrsEl.value = cat.default_hours;
  }
}

function renderAdminCategories() {
  const tbody = document.getElementById('adminCategoriesBody');
  if (!tbody) return;
  if (kpchCategories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">ยังไม่มีประเภท กพช.</td></tr>';
    return;
  }
  tbody.innerHTML = kpchCategories.map(c => `
    <tr>
      <td>${esc(c.cat_id)}</td><td class="fw-semibold">${esc(c.cat_name)}</td><td>${esc(c.default_project || '-')}</td>
      <td class="text-center">${esc(c.default_hours || 25)}</td>
      <td><span class="badge ${c.status === 'INACTIVE' ? 'bg-secondary' : 'bg-success'}">${esc(c.status)}</span></td>
      <td class="text-end text-nowrap">
        <button type="button" class="btn btn-warning btn-sm rounded-pill" onclick="openCategoryModal('${escJs(c.cat_id)}')"><i class="bi bi-pencil"></i> แก้ไข</button>
        <button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="confirmDeleteCategory('${escJs(c.cat_id)}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('');
}

function openCategoryModal(catId) {
  const c = kpchCategories.find(x => x.cat_id === catId);
  document.getElementById('catModalTitle').innerText = c ? 'แก้ไขประเภท กพช.' : 'เพิ่มประเภท กพช. ใหม่';
  document.getElementById('cat_id').value = c ? c.cat_id : '';
  document.getElementById('cat_name').value = c ? c.cat_name : '';
  document.getElementById('cat_default_project').value = c ? (c.default_project || '') : '';
  document.getElementById('cat_default_hours').value = c ? (c.default_hours || 25) : 25;
  document.getElementById('cat_default_rationale').value = c ? (c.default_rationale || '') : '';
  document.getElementById('cat_status').value = c ? (c.status || 'ACTIVE') : 'ACTIVE';
  openModalById('categoryModal');
}

async function handleSaveCategory() {
  const catName = document.getElementById('cat_name').value.trim();
  if (!catName) return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อประเภท กพช.', 'warning');
  showLoading('กำลังบันทึกประเภท กพช. ลงชีต...');
  try {
    const res = await callApi('saveCategoryAdmin', {
      token: authToken,
      category_data: {
        cat_id: document.getElementById('cat_id').value, cat_name: catName,
        default_project: document.getElementById('cat_default_project').value.trim(),
        default_hours: document.getElementById('cat_default_hours').value,
        default_rationale: document.getElementById('cat_default_rationale').value.trim(),
        status: document.getElementById('cat_status').value
      }
    });
    hideLoading(); kpchCategories = res.categories || []; populateCategorySelects(); renderAdminCategories(); closeModalById('categoryModal');
    safeAlert('สำเร็จ', 'บันทึกประเภท กพช. ลง Google Sheet เรียบร้อยแล้ว', 'success');
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function confirmDeleteCategory(catId) {
  Swal.fire({ title: 'ยืนยันลบประเภท กพช. นี้?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย', confirmButtonColor: '#dc2626' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังลบ...');
      try { const r = await callApi('deleteCategoryAdmin', { token: authToken, cat_id: catId }); hideLoading(); kpchCategories = r.categories || []; populateCategorySelects(); renderAdminCategories(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function fillDefaultKpch4Template() {
  if (!document.getElementById('f_k4_plan').value) document.getElementById('f_k4_plan').value = '1. ปรึกษาครูผู้สอนเข้าร่วมกิจกรรม/โครงการ\n2. เตรียมตัวเข้าร่วมกิจกรรมพัฒนาคุณภาพชีวิตของนักศึกษา\n3. พัฒนาการเรียนรู้มุ่งเน้นการพัฒนาชุมชนและสังคม';
  if (!document.getElementById('f_activity_detail').value) document.getElementById('f_activity_detail').value = '1. วางแผนการเข้าร่วมกิจกรรม\n2. ปรึกษาครูที่ปรึกษา\n3. เข้าร่วมกิจกรรมการลงทะเบียน\n4. เสนอโครงการการจัดกิจกรรมต่อสถานศึกษาเพื่อให้คณะกรรมการพิจารณาอนุมัติ\n5. ดำเนินจัดกิจกรรมตามแผนที่กำหนด\n6. สรุปและรายงานผลการดำเนินงาน ขออนุมัติชั่วโมง กพช.';
  if (!document.getElementById('f_k4_learning').value) document.getElementById('f_k4_learning').value = '1. การวางแผนการเข้าร่วมกิจกรรม\n2. ได้เรียนรู้คุณค่าของการทำความดี การมีน้ำใจ การเสียสละ และการช่วยเหลือผู้อื่นโดยไม่หวังสิ่งตอบแทน\n3. เพื่อได้รับประสบการณ์ในการทำกิจกรรมพัฒนาคุณภาพชีวิต';
  if (!document.getElementById('f_k4_apply').value) document.getElementById('f_k4_apply').value = '1. ได้ทำประโยชน์ให้กับส่วนรวม\n2. นักศึกษาที่ทำกิจกรรมเป็นการพัฒนาตนเอง ในด้านการคิด การกระทำ และการฝึกบันทึกเพื่อการดำเนินชีวิต';
}

// ==================== หน้าแรก (นักศึกษา) ====================
function switchPublicTab(tab) {
  document.getElementById('tabBtnPre12').classList.toggle('active', tab === 'pre12');
  document.getElementById('tabBtnSubmit').classList.toggle('active', tab === 'submit');
  document.getElementById('tabBtnStatus').classList.toggle('active', tab === 'status');
  document.getElementById('publicPre12View').classList.toggle('d-none', tab !== 'pre12');
  document.getElementById('publicSubmitView').classList.toggle('d-none', tab !== 'submit');
  document.getElementById('publicStatusView').classList.toggle('d-none', tab !== 'status');
}

function renderAnnouncement(ann) {
  const box = document.getElementById('announcementBox'), pdfArea = document.getElementById('annPdfArea');
  if (!box) return;
  if (!ann || !ann.visible) { box.classList.add('d-none'); if (pdfArea) { pdfArea.classList.add('d-none'); pdfArea.innerHTML = ''; } return; }
  box.classList.remove('d-none');
  document.getElementById('annBadgeText').innerText = ann.badge || '';
  document.getElementById('annContentText').innerText = ann.content || '';
  if (pdfArea) {
    if (ann.pdf_url) {
      pdfArea.classList.remove('d-none');
      pdfArea.innerHTML = `<a href="${esc(ann.pdf_url)}" target="_blank" class="btn btn-danger btn-sm rounded-pill px-3 fw-bold shadow-sm"><i class="bi bi-file-earmark-pdf-fill me-1"></i>เปิดอ่าน / ดาวน์โหลดเอกสารแนบ (${esc(ann.pdf_name || 'PDF')})</a>`;
    } else { pdfArea.classList.add('d-none'); pdfArea.innerHTML = ''; }
  }
}

async function loadPublicData() {
  const sel1 = document.getElementById('p12_teacher_id'), sel2 = document.getElementById('f_teacher_id'), selEdit = document.getElementById('se_teacher_id'), errEl = document.getElementById('teacherLoadError');
  try {
    const data = await callApi('getPublicData');
    if (errEl) errEl.classList.add('d-none');
    renderAnnouncement(data.announcement);
    kpchCategories = data.categories || [];
    populateCategorySelects();
    publicTeachersList = data.teachers || [];
    const html = publicTeachersList.length === 0 ? '<option value="">-- ยังไม่มีรายชื่อครูในระบบ --</option>'
      : '<option value="">-- กรุณาเลือกครูประจำกลุ่ม --</option>' + publicTeachersList.map(t => `<option value="${esc(t.user_id)}">${esc(t.full_name)} (${esc(t.group_name)})</option>`).join('');
    if (sel1) sel1.innerHTML = html;
    if (sel2) sel2.innerHTML = html;
    if (selEdit) selEdit.innerHTML = html;
  } catch (err) {
    const errOpt = '<option value="">-- โหลดรายชื่อครูไม่สำเร็จ --</option>';
    if (sel1) sel1.innerHTML = errOpt;
    if (sel2) sel2.innerHTML = errOpt;
    if (selEdit) selEdit.innerHTML = errOpt;
    if (errEl) { errEl.innerText = err.message; errEl.classList.remove('d-none'); }
  }
}

function onSelectPre12Teacher() {
  const tid = document.getElementById('p12_teacher_id').value;
  const t = publicTeachersList.find(x => x.user_id === tid);
  if (t && t.group_name) document.getElementById('p12_group_name').value = t.group_name;
}

async function handlePre12Submit() {
  const sid = document.getElementById('p12_student_id').value.trim(),
        sname = document.getElementById('p12_student_name').value.trim(),
        lvl = document.getElementById('p12_level').value,
        tid = document.getElementById('p12_teacher_id').value,
        grp = document.getElementById('p12_group_name').value.trim(),
        cat = document.getElementById('p12_category').value,
        term = document.getElementById('p12_term').value.trim(),
        roleNote = document.getElementById('p12_role_note').value,
        actName = document.getElementById('p12_activity_name').value.trim(),
        startDate = document.getElementById('p12_start_date').value,
        endDate = document.getElementById('p12_end_date').value,
        loc = document.getElementById('p12_location').value.trim(),
        evalOk = document.getElementById('p12_self_eval_ok').checked;

  if (!validateStudentId10(sid)) return safeAlert('รหัสนักศึกษาไม่ถูกต้อง', 'กรุณากรอกรหัสนักศึกษาที่ขึ้นต้นด้วยเลข 6 และมี 10 หลักเท่านั้น (เช่น 6912345678)', 'warning');
  if (!sname || !lvl || !tid || !grp || !cat || !term || !actName || !startDate || !endDate) return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * และเลือกประเภท กพช. ให้ครบทุกช่อง', 'warning');
  if (endDate < startDate) return safeAlert('วันที่ไม่ถูกต้อง', 'วันที่คาดว่าจะสิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม', 'warning');

  const evalScores = [];
  for (let i = 1; i <= 10; i++) {
    const checked = document.querySelector(`input[name="eval_q${i}"]:checked`);
    if (!checked) return safeAlert('แบบประเมินยังไม่ครบ', `กรุณาเลือกคำตอบในตารางแบบประเมินตนเอง (กพช. 2) ข้อที่ ${i}`, 'warning');
    evalScores.push(checked.value);
  }
  if (!evalOk) return safeAlert('กรุณายืนยัน', 'กรุณาติ๊กถูกช่องรับรองข้อมูลด้านล่างก่อนยื่นคำขอ', 'warning');

  showLoading('กำลังตรวจสอบข้อมูลและส่งคำขอ กพช.1-2...');
  try {
    const elig = await callApi('checkEligibility', { student_id: sid });
    const targetTerm = formatTermText(term);
    const dup = (elig.approvals12 || []).find(x => formatTermText(x.term) === targetTerm && ['WAIT_TEACHER_12', 'APPROVED_12'].includes(x.status_12));
    if (dup) {
      hideLoading();
      return safeAlert(dup.status_12 === 'APPROVED_12' ? 'มีสิทธิ์ กพช.1-2 ในภาคเรียนนี้แล้ว ✅' : 'ยื่นคำขอในภาคเรียนนี้ไว้แล้ว ⏳',
        `รหัสนักศึกษา <b>${esc(sid)}</b> มีคำขอในภาคเรียน <b>${esc(targetTerm)}</b> แล้ว (รหัส: <b>${esc(dup.req12_id)}</b>)<br>หากข้อมูลผิดสามารถแก้ไขได้ที่แท็บ <b>"🔍 เช็กสถานะ"</b>`, 'info');
    }

    const res = await callApi('submitPreApproval12', {
      payload: {
        student_id: sid, student_name: sname, level: lvl, teacher_id: tid, group_name: grp,
        term, category: cat, role_note: roleNote, activity_name: actName,
        plan_start_date: startDate, plan_end_date: endDate, location: loc,
        eval_scores: evalScores, self_eval_ok: evalOk
      }
    });
    hideLoading();
    safeAlert('ยื่นขอ กพช.1-2 สำเร็จ! 📋', `รหัสคำขอของคุณคือ <b class="text-primary">${esc(res.req12_id)}</b><br>กรุณารอครูประจำกลุ่มอนุมัติก่อนลงมือทำกิจกรรม`, 'success');
    ['p12_student_id','p12_student_name','p12_level','p12_teacher_id','p12_group_name','p12_category','p12_role_note','p12_activity_name','p12_start_date','p12_end_date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const locEl = document.getElementById('p12_location');
    if (locEl) locEl.value = 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง จังหวัดปทุมธานี';
    for (let i = 1; i <= 10; i++) document.querySelectorAll(`input[name="eval_q${i}"]`).forEach(el => el.checked = false);
    document.getElementById('p12_self_eval_ok').checked = false;
  } catch (err) { hideLoading(); safeAlert('เกิดข้อผิดพลาด', err.message, 'error'); }
}

function resetSubmitLock(btnText) {
  const btn = document.getElementById('btnSubmitKPCH');
  btn.disabled = true;
  btn.innerHTML = `<i class="bi bi-lock me-2"></i>${btnText || 'กรุณาตรวจสอบสิทธิ์ กพช.1-2 ด้านบนก่อนส่งผลงาน'}`;
  document.getElementById('ref12SelectWrap').classList.add('d-none');
  document.getElementById('f_ref_12_id').innerHTML = '';
  currentEligibleList12 = [];
}

async function checkEligibilityUI() {
  const sid = document.getElementById('f_student_id').value.trim(), banner = document.getElementById('eligibilityBanner');
  if (!validateStudentId10(sid)) return safeAlert('รหัสนักศึกษาไม่ถูกต้อง', 'รหัสนักศึกษาต้องขึ้นต้นด้วยเลข 6 และมี 10 หลักเท่านั้น (เช่น 6912345678)', 'warning');

  showLoading('กำลังตรวจสอบสิทธิ์ กพช.1-2...');
  try {
    const res = await callApi('checkEligibility', { student_id: sid });
    hideLoading(); banner.classList.remove('d-none');
    if (!res.hasAny12) {
      resetSubmitLock('ไม่สามารถส่งได้ (ยังไม่ได้ขออนุมัติ กพช.1-2)');
      banner.innerHTML = `<div class="alert alert-danger mb-0 rounded-3 small"><div class="fw-bold mb-1">❌ ยังไม่พบคำขออนุมัติทำ กพช. ของรหัส ${esc(sid)}</div><button type="button" class="btn btn-danger btn-sm rounded-pill mt-1 fw-bold" onclick="goToPre12WithId('${escJs(sid)}')">📋 ไปหน้าขออนุมัติ กพช.1-2 ทันที</button></div>`;
      return;
    }
    const approvedList = (res.approvals12 || []).filter(x => x.status_12 === 'APPROVED_12');
    if (approvedList.length === 0) {
      const latest = res.approvals12[0], st = STEP12_LABELS[latest.status_12] || { text: latest.status_12 };
      resetSubmitLock('รอครูอนุมัติ กพช.1-2 ก่อนจึงจะส่งผลงานได้');
      banner.innerHTML = `<div class="alert alert-warning mb-0 rounded-3 small"><div class="fw-bold mb-1">⏳ ยังไม่สามารถส่งผลงานได้ (สถานะ: ${esc(st.text)})</div><div>รหัส: <b>${esc(latest.req12_id)}</b> | ${esc(latest.activity_name)}</div>${latest.status_12 === 'REJECTED_12' ? `<div class="text-danger mt-1"><b>เหตุผลที่ตีกลับ:</b> ${esc(latest.reject_reason_12)} — ไปแก้ไขได้ที่แท็บ <b>"🔍 เช็กสถานะ"</b></div>` : ''}</div>`;
      return;
    }
    currentEligibleList12 = approvedList;
    banner.innerHTML = `<div class="alert alert-success mb-0 rounded-3 small"><b>✅ ผ่านการตรวจสอบสิทธิ์ กพช.1-2 แล้ว!</b></div>`;
    document.getElementById('ref12SelectWrap').classList.remove('d-none');
    document.getElementById('f_ref_12_id').innerHTML = approvedList.map(x => `<option value="${esc(x.req12_id)}">${esc(x.req12_id)} (ภาคเรียน ${esc(formatTermText(x.term))}) - ${esc(x.activity_name)}</option>`).join('');
    onSelectApproved12();
    const btn = document.getElementById('btnSubmitKPCH'); btn.disabled = false; btn.innerHTML = `<i class="bi bi-send-heart me-2"></i>ส่งรายงานผล กพช.4`;
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function goToPre12WithId(sid) {
  document.getElementById('p12_student_id').value = sid;
  switchPublicTab('pre12');
}

function onSelectApproved12() {
  const id = document.getElementById('f_ref_12_id').value;
  const found = currentEligibleList12.find(x => x.req12_id === id);
  if (!found) return;
  document.getElementById('f_student_name').value = found.student_name || '';
  document.getElementById('f_level').value = found.level || '';
  document.getElementById('f_teacher_id').value = found.teacher_id || '';
  document.getElementById('f_group_name').value = found.group_name || '';
  if (found.category) document.getElementById('f_category').value = found.category;
  if (!found.is_used) {
    document.getElementById('f_activity_name').value = found.activity_name || '';
    document.getElementById('f_activity_date').value = toInputDate(found.plan_start_date);
    document.getElementById('f_activity_end_date').value = toInputDate(found.plan_end_date);
    document.getElementById('f_location').value = found.location || '';
  }
}

async function handleImageSelection(input) {
  const files = Array.from(input.files || []), box = document.getElementById('imagePreviewBox');
  box.innerHTML = ''; compressedImages = [];
  if (files.length < 2 || files.length > 3) { safeAlert('แจ้งเตือน', 'กรุณาเลือกรูปภาพจำนวน 2 ถึง 3 ภาพเท่านั้น', 'warning'); input.value = ''; return; }
  showLoading('กำลังย่อขนาดรูปภาพ...');
  try {
    for (const file of files) {
      const b64 = await compressImageFile(file, 1024, 0.75);
      compressedImages.push({ name: file.name, mimeType: 'image/jpeg', base64Data: b64.split(',')[1] });
      box.innerHTML += `<img src="${b64}" class="thumb-preview">`;
    }
  } catch (err) {
    compressedImages = []; box.innerHTML = ''; input.value = '';
    safeAlert('ผิดพลาด', 'ไม่สามารถอ่านไฟล์รูปภาพได้', 'error');
  } finally { hideLoading(); }
}

async function handleEditImageSelection(input) {
  const files = Array.from(input.files || []), box = document.getElementById('se_imagePreviewBox');
  box.innerHTML = ''; editCompressedImages = [];
  if (files.length === 0) return;
  if (files.length < 2 || files.length > 3) { safeAlert('แจ้งเตือน', 'หากต้องการเปลี่ยนรูป กรุณาเลือก 2 ถึง 3 ภาพ', 'warning'); input.value = ''; return; }
  showLoading('กำลังย่อขนาดรูปภาพใหม่...');
  try {
    for (const file of files) {
      const b64 = await compressImageFile(file, 1024, 0.75);
      editCompressedImages.push({ name: file.name, mimeType: 'image/jpeg', base64Data: b64.split(',')[1] });
      box.innerHTML += `<img src="${b64}" class="thumb-preview">`;
    }
  } catch (err) {
    editCompressedImages = []; box.innerHTML = ''; input.value = '';
    safeAlert('ผิดพลาด', 'ไม่สามารถอ่านไฟล์รูปภาพได้', 'error');
  } finally { hideLoading(); }
}

function compressImageFile(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) { if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; } else { w = Math.round(w * maxSize / h); h = maxSize; } }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

async function handleStudentSubmit() {
  const sid = document.getElementById('f_student_id').value.trim(),
        ref12Id = document.getElementById('f_ref_12_id').value,
        sname = document.getElementById('f_student_name').value.trim(),
        lvl = document.getElementById('f_level').value,
        cat = document.getElementById('f_category').value,
        tid = document.getElementById('f_teacher_id').value,
        grp = document.getElementById('f_group_name').value.trim(),
        hrs = document.getElementById('f_hours').value,
        actName = document.getElementById('f_activity_name').value.trim(),
        startDate = document.getElementById('f_activity_date').value,
        endDate = document.getElementById('f_activity_end_date').value,
        loc = document.getElementById('f_location').value.trim(),
        detail = document.getElementById('f_activity_detail').value.trim();

  if (!validateStudentId10(sid)) return safeAlert('รหัสนักศึกษาไม่ถูกต้อง', 'รหัสนักศึกษาต้องขึ้นต้นด้วยเลข 6 และมี 10 หลักเท่านั้น', 'warning');
  if (!ref12Id) return safeAlert('ยังไม่ได้รับอนุมัติ กพช.1-2', 'กรุณาตรวจสอบสิทธิ์ กพช.1-2 ก่อนส่งผลงาน', 'warning');
  if (!sname || !lvl || !cat || !tid || !grp || !hrs || Number(hrs) <= 0 || !actName || !startDate || !endDate || !detail) return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * และเลือกประเภท กพช. ให้ครบ', 'warning');
  if (endDate < startDate) return safeAlert('วันที่ไม่ถูกต้อง', 'วันสิ้นสุดโครงการต้องไม่น้อยกว่าวันที่เริ่มโครงการ', 'warning');
  if (compressedImages.length < 2 || compressedImages.length > 3) return safeAlert('รูปภาพไม่ครบ', 'กรุณาแนบรูปภาพกิจกรรม 2 - 3 ภาพ', 'warning');

  showLoading('กำลังอัปโหลดรูปภาพและบันทึกข้อมูล...');
  try {
    const res = await callApi('submitKPCH', {
      payload: {
        ref_12_id: ref12Id, student_id: sid, student_name: sname, level: lvl, category: cat, teacher_id: tid, group_name: grp, hours: hrs,
        activity_name: actName, activity_date: startDate, activity_end_date: endDate, location: loc,
        k4_plan: document.getElementById('f_k4_plan').value.trim(), activity_detail: detail,
        k4_learning: document.getElementById('f_k4_learning').value.trim(), k4_problem: document.getElementById('f_k4_problem').value.trim(), k4_apply: document.getElementById('f_k4_apply').value.trim(),
        images: compressedImages
      }
    });
    hideLoading();
    safeAlert('ส่งรายงานผล กพช.4 สำเร็จ! 🎉', `รหัสคำขอของคุณคือ <b class="text-primary">${esc(res.req_id)}</b><br>เรื่องถูกส่งไปยังครูประจำกลุ่มเรียบร้อยแล้ว`, 'success');
    ['f_student_id','f_student_name','f_level','f_category','f_teacher_id','f_group_name','f_hours','f_activity_name','f_activity_date','f_activity_end_date','f_location','f_k4_plan','f_activity_detail','f_k4_learning','f_k4_apply','f_images'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const probEl = document.getElementById('f_k4_problem');
    if (probEl) probEl.value = 'ไม่พบปัญหาในการทำงาน';
    document.getElementById('imagePreviewBox').innerHTML = ''; document.getElementById('eligibilityBanner').classList.add('d-none');
    compressedImages = []; resetSubmitLock();
  } catch (err) { hideLoading(); safeAlert('เกิดข้อผิดพลาด', err.message, 'error'); }
}
// ==================== เช็กสถานะ + แก้ไข + นักศึกษาพิมพ์ / โหลด Word ของตัวเอง ====================
async function searchMyStatus() {
  const sid = document.getElementById('searchStudentId').value.trim();
  if (!validateStudentId10(sid)) return safeAlert('รหัสนักศึกษาไม่ถูกต้อง', 'กรุณากรอกรหัสนักศึกษา 10 หลัก (ขึ้นต้นด้วยเลข 6)', 'warning');

  showLoading('กำลังค้นหาข้อมูล...');
  try {
    const res = await callApi('checkStatus', { student_id: sid });
    hideLoading();
    const list12 = res.approvals12 || [], listSubs = res.submissions || [];
    lastStatus12List = list12; lastStatusSubList = listSubs;
    const area = document.getElementById('statusResultArea');

    if (list12.length === 0 && listSubs.length === 0) {
      area.innerHTML = `<div class="alert alert-warning rounded-4 text-center"><div class="fw-bold mb-1">❌ ยังไม่พบประวัติของรหัส ${esc(sid)}</div><button type="button" class="btn btn-primary btn-sm rounded-pill fw-bold mt-2" onclick="goToPre12WithId('${escJs(sid)}')">📋 ไปยื่นขอ กพช.1-2 ตอนนี้</button></div>`;
      return;
    }

    let html = '<h6 class="fw-bold text-primary mb-2">📋 1. สถานะคำขออนุมัติทำ กพช. (กพช.1-2)</h6>';
    if (list12.length === 0) html += '<div class="alert alert-secondary small rounded-3">ยังไม่มีรายการขอ กพช.1-2</div>';
    else {
      html += list12.map(r => {
        const st = STEP12_LABELS[r.status_12] || { text: r.status_12, cls: 'bg-secondary' };
        const canEdit = ['WAIT_TEACHER_12', 'REJECTED_12'].includes(r.status_12);
        return `
          <div class="mobile-item-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div><span class="badge bg-light text-primary border me-1">${esc(r.req12_id)}</span>${r.category ? `<span class="badge bg-info bg-opacity-10 text-dark border me-1">${esc(r.category)}</span>` : ''}<strong>${esc(r.activity_name)}</strong>
                <div class="small text-muted mt-1">ผู้ขอ: ${esc(r.student_name)} | ครู: ${esc(r.teacher_name)} | ภาคเรียน: ${esc(formatTermText(r.term))}<br>แผนวันที่: ${formatShortThaiDate(r.plan_start_date)} ถึง ${formatShortThaiDate(r.plan_end_date)}</div>
              </div>
              <span class="badge step-badge ${st.cls}">${st.text}</span>
            </div>
            ${r.status_12 === 'APPROVED_12' ? `<div class="small text-success fw-semibold mt-2">✅ อนุมัติเมื่อ: ${esc(r.approved_at_12)}</div>` : ''}
            ${r.reject_reason_12 ? `<div class="alert alert-danger mt-2 mb-1 py-2 small rounded-3"><b>เหตุผลที่ครูตีกลับ:</b> ${esc(r.reject_reason_12)}</div>` : ''}
            <div class="d-flex flex-wrap gap-2 mt-2">
              ${canEdit ? `<button type="button" class="btn btn-warning btn-sm rounded-pill fw-bold" onclick="openStudentEditModal('12', '${escJs(r.req12_id)}')"><i class="bi bi-pencil-square me-1"></i>ปรับปรุง / แก้ไขข้อมูล</button>` : ''}
              <button type="button" class="btn btn-outline-dark btn-sm rounded-pill fw-bold" onclick="printMySelf12('${escJs(r.req12_id)}')"><i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word กพช.1-2 ของฉัน</button>
            </div>
          </div>`;
      }).join('');
    }

    html += '<h6 class="fw-bold text-primary mt-4 mb-2">📸 2. สถานะรายงานผลสำเร็จ กพช.4 (3 ขั้นตอน: ส่ง ➔ ครู ➔ นายทะเบียน)</h6>';
    if (listSubs.length === 0) html += '<div class="alert alert-light border small rounded-3">ยังไม่มีการส่งบันทึกผลงานพร้อมรูปภาพ</div>';
    else {
      html += listSubs.map(r => {
        const st = STEP_LABELS[r.current_step] || { text: r.current_step, cls: 'bg-secondary' };
        const canEdit = ['WAIT_TEACHER', 'REJECTED'].includes(r.current_step);
        const steps = [
          { label: '1. ส่งรายงานผล', done: true },
          { label: '2. ครูอนุมัติ', done: !!r.teacher_approved_at || r.current_step === 'APPROVED_FOR_REGISTRAR' || r.current_step === 'COMPLETED' },
          { label: '3. นายทะเบียนบันทึก', done: r.current_step === 'COMPLETED' }
        ];
        const progHtml = steps.map(s => `<div class="prog-step ${s.done ? 'done' : (r.current_step === 'REJECTED' ? 'rejected' : '')}"><div>${s.done ? '✅' : (r.current_step === 'REJECTED' ? '❌' : '⏳')}</div><div>${s.label}</div></div>`).join('');
        return `
          <div class="mobile-item-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div><span class="badge bg-light text-primary border me-1">${esc(r.req_id)}</span>${r.category ? `<span class="badge bg-info bg-opacity-10 text-dark border me-1">${esc(r.category)}</span>` : ''}<strong>${esc(r.activity_name)}</strong>
                <div class="small text-muted mt-1">ผู้ส่ง: ${esc(r.student_name)} | ครู: ${esc(r.teacher_name)} | จำนวน: <b>${esc(r.hours)} ชม.</b><br>ช่วงวันที่: ${formatShortThaiDate(r.activity_date)} ถึง ${formatShortThaiDate(r.activity_end_date)}</div>
              </div>
              <span class="badge step-badge ${st.cls}">${st.text}</span>
            </div>
            <div class="cute-progress-bar">${progHtml}</div>
            ${r.reject_reason ? `<div class="alert alert-danger mt-2 mb-1 py-2 small rounded-3"><b>เหตุผลที่ครูตีกลับ:</b> ${esc(r.reject_reason)}</div>` : ''}
            <div class="d-flex flex-wrap gap-2 mt-2">
              ${canEdit ? `<button type="button" class="btn btn-warning btn-sm rounded-pill fw-bold" onclick="openStudentEditModal('sub', '${escJs(r.req_id)}')"><i class="bi bi-pencil-square me-1"></i>ปรับปรุง / แก้ไขข้อมูล</button>` : ''}
              <button type="button" class="btn btn-outline-dark btn-sm rounded-pill fw-bold" onclick="printMySelf4('${escJs(r.req_id)}')"><i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word กพช.4 ของฉัน</button>
            </div>
          </div>`;
      }).join('');
    }
    area.innerHTML = html;
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function printMySelf12(req12Id) {
  const item = lastStatus12List.find(x => x.req12_id === req12Id);
  if (!item) return;
  choosePrintOrWord(
    `กพช.1-2 (${item.req12_id})`,
    () => {
      document.getElementById('printOnlyContainer').innerHTML = buildKPCH12Html(item, false);
      triggerPrint();
    },
    () => {
      exportHtmlToWord(`กพช1-2_${item.student_id || 'doc'}_${item.req12_id}`, buildKPCH12Html(item, true));
    }
  );
}

function buildMySelf4Html(item, forWord = false) {
  const sDate = formatThaiDateWithLabel(item.activity_date), eDate = formatThaiDateWithLabel(item.activity_end_date);
  const imgs = [item.img_1, item.img_2, item.img_3].filter(Boolean).map(u => getDriveThumb(u));
  const k4 = buildKPCH4Html([item], { projName: item.activity_name || '', sDate, eDate, loc: item.location || '', tName: item.teacher_name || '' }, forWord);
  if (imgs.length === 0) return k4;

  if (forWord) {
    const rows = [];
    for (let i = 0; i < imgs.length; i += 2) {
      const c1 = `<td style="width:50%; text-align:center; padding:8px; vertical-align:top;"><img src="${esc(imgs[i])}" width="250" style="width:250px; max-width:100%; height:auto; border:1px solid #cbd5e1;" /></td>`;
      const c2 = imgs[i + 1]
        ? `<td style="width:50%; text-align:center; padding:8px; vertical-align:top;"><img src="${esc(imgs[i + 1])}" width="250" style="width:250px; max-width:100%; height:auto; border:1px solid #cbd5e1;" /></td>`
        : `<td style="width:50%;"></td>`;
      rows.push(`<tr>${c1}${c2}</tr>`);
    }
    const photoPageWord = `
      ${wordPageBreak()}
      <div>
        <div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:10px;">ภาพถ่ายประกอบการดำเนินกิจกรรม (${esc(item.student_name)})</div>
        <table border="0" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse;">
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
    return k4 + photoPageWord;
  }

  const photoPage = `<div class="page-break-before"><div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:10px;">ภาพถ่ายประกอบการดำเนินกิจกรรม (${esc(item.student_name)})</div><div class="photo-grid">${imgs.map(u => `<img src="${esc(u)}">`).join('')}</div></div>`;
  return k4 + photoPage;
}

function printMySelf4(reqId) {
  const item = lastStatusSubList.find(x => x.req_id === reqId);
  if (!item) return;
  choosePrintOrWord(
    `รายงานผล กพช.4 (${item.req_id})`,
    () => {
      document.getElementById('printOnlyContainer').innerHTML = buildMySelf4Html(item, false);
      triggerPrint();
    },
    () => {
      exportHtmlToWord(`กพช4_${item.student_id || 'doc'}_${item.req_id}`, buildMySelf4Html(item, true));
    }
  );
}

function openStudentEditModal(itemType, id) {
  const item = itemType === '12' ? lastStatus12List.find(x => x.req12_id === id) : lastStatusSubList.find(x => x.req_id === id);
  if (!item) return;
  editCompressedImages = [];
  document.getElementById('se_images').value = ''; document.getElementById('se_imagePreviewBox').innerHTML = '';
  document.getElementById('se_type').value = itemType; document.getElementById('se_id').value = id; document.getElementById('se_req_id').innerText = id;
  document.getElementById('se_student_name').value = item.student_name || ''; document.getElementById('se_level').value = item.level || '';
  document.getElementById('se_teacher_id').value = item.teacher_id || ''; document.getElementById('se_group_name').value = item.group_name || '';

  const catSel = document.getElementById('se_category');
  if (item.category && !Array.from(catSel.options).some(o => o.value === item.category)) {
    const opt = document.createElement('option');
    opt.value = item.category;
    opt.textContent = item.category;
    catSel.appendChild(opt);
  }
  catSel.value = item.category || '';
  document.getElementById('se_activity_name').value = item.activity_name || '';
  document.getElementById('se_location').value = item.location || '';

  const rejEl = document.getElementById('se_reject_alert'), rejMsg = itemType === '12' ? item.reject_reason_12 : item.reject_reason;
  if (rejMsg) { rejEl.innerHTML = `<b>เหตุผลที่ถูกตีกลับ:</b> ${esc(rejMsg)}`; rejEl.classList.remove('d-none'); } else rejEl.classList.add('d-none');

  const is12 = itemType === '12';
  document.getElementById('se_hours_wrap').classList.toggle('d-none', is12);
  document.getElementById('se_role_wrap').classList.toggle('d-none', !is12);
  document.getElementById('se_k4_wrap').classList.toggle('d-none', is12);
  if (is12) {
    document.getElementById('se_start_date').value = toInputDate(item.plan_start_date);
    document.getElementById('se_end_date').value = toInputDate(item.plan_end_date);
    document.getElementById('se_role_note').value = item.role_note || '';
  } else {
    document.getElementById('se_hours').value = item.hours || '';
    document.getElementById('se_start_date').value = toInputDate(item.activity_date);
    document.getElementById('se_end_date').value = toInputDate(item.activity_end_date);
    document.getElementById('se_k4_plan').value = item.k4_plan || '';
    document.getElementById('se_detail').value = item.activity_detail || '';
    document.getElementById('se_k4_learning').value = item.k4_learning || '';
    document.getElementById('se_k4_problem').value = item.k4_problem || '';
    document.getElementById('se_k4_apply').value = item.k4_apply || '';
  }
  openModalById('studentEditModal');
}

async function saveStudentEdit() {
  const itemType = document.getElementById('se_type').value, sid = document.getElementById('searchStudentId').value.trim();
  const payload = {
    item_type: itemType, id: document.getElementById('se_id').value, student_id: sid,
    student_name: document.getElementById('se_student_name').value.trim(), level: document.getElementById('se_level').value,
    teacher_id: document.getElementById('se_teacher_id').value, group_name: document.getElementById('se_group_name').value.trim(),
    category: document.getElementById('se_category').value, activity_name: document.getElementById('se_activity_name').value.trim(),
    start_date: document.getElementById('se_start_date').value, end_date: document.getElementById('se_end_date').value,
    location: document.getElementById('se_location').value.trim()
  };

  if (!payload.student_name || !payload.level || !payload.teacher_id || !payload.group_name || !payload.category || !payload.activity_name || !payload.start_date || !payload.end_date) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลสำคัญให้ครบทุกช่อง', 'warning');
  }
  if (payload.end_date < payload.start_date) {
    return safeAlert('วันที่ไม่ถูกต้อง', 'วันสิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม', 'warning');
  }

  if (itemType === '12') {
    payload.role_note = document.getElementById('se_role_note').value;
  } else {
    payload.hours = document.getElementById('se_hours').value;
    payload.k4_plan = document.getElementById('se_k4_plan').value.trim();
    payload.activity_detail = document.getElementById('se_detail').value.trim();
    payload.k4_learning = document.getElementById('se_k4_learning').value.trim();
    payload.k4_problem = document.getElementById('se_k4_problem').value.trim();
    payload.k4_apply = document.getElementById('se_k4_apply').value.trim();
    if (!payload.hours || Number(payload.hours) <= 0 || !payload.activity_detail) {
      return safeAlert('ข้อมูลไม่ครบ', 'กรุณาระบุจำนวนชั่วโมง (มากกว่า 0) และรายละเอียดการดำเนินงานให้ครบ', 'warning');
    }
    if (editCompressedImages.length >= 2) payload.images = editCompressedImages;
  }

  showLoading('กำลังบันทึกการแก้ไขข้อมูล...');
  try {
    await callApi('studentUpdateRecord', { payload });
    hideLoading(); closeModalById('studentEditModal');
    safeAlert('แก้ไขเรียบร้อย ✅', 'ข้อมูลถูกปรับปรุงและส่งกลับให้ครูตรวจสอบใหม่อีกครั้งแล้ว', 'success');
    await searchMyStatus();
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function buildKPCH12Html(item, forWord = false) {
  const nameParts = (item.student_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '', lastName = nameParts.slice(1).join(' ') || '-';
  const termObj = parseTermParts(item.term);
  const blankDateLine = '........./................../..............';
  const regNameDisplay = registrarName ? esc(registrarName) : '....................................';
  let scores = [];
  try { scores = JSON.parse(item.eval_scores || '[]'); } catch (e) {}
  const passChecked = item.status_12 !== 'REJECTED_12', rejectChecked = item.status_12 === 'REJECTED_12';

  if (forWord) {
    const evalRowsWord = EVAL_QUESTIONS_12.map((q, i) => `
      <tr>
        <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${i + 1}</td>
        <td style="border:1px solid #000; padding:3px 6px;">${q}</td>
        <td style="border:1px solid #000; text-align:center; font-weight:bold; padding:3px 5px;">${scores[i] === 'มาก' ? '✓' : ''}</td>
        <td style="border:1px solid #000; text-align:center; font-weight:bold; padding:3px 5px;">${scores[i] === 'ปานกลาง' ? '✓' : ''}</td>
        <td style="border:1px solid #000; text-align:center; font-weight:bold; padding:3px 5px;">${scores[i] === 'น้อย' ? '✓' : ''}</td>
        <td style="border:1px solid #000; padding:3px 5px;"></td>
      </tr>`).join('');

    return `
      <div style="line-height:1.75; font-size:16pt;">
        <div style="text-align:right; font-weight:bold; margin-bottom:10px;">กพช. 1</div>
        <div style="text-align:center; font-weight:bold; font-size:18pt; margin-bottom:12px;">แบบลงทะเบียนกิจกรรมพัฒนาคุณภาพชีวิต (รายบุคคล)</div>
        <div style="text-align:center; margin-bottom:8px;"><b>สถานศึกษา</b> &nbsp; ${wordLineFill(SCHOOL_NAME, '..............................................................')}</div>
        <div style="text-align:center; margin-bottom:24px;"><b>ภาคเรียนที่</b> &nbsp; ${wordLineFill(termObj.no, '........')} &nbsp;/&nbsp; ${wordLineFill(termObj.year, '............')}</div>
        <div style="margin-bottom:12px;">ชื่อ ${wordLineFill(firstName, '..............................')} &nbsp;&nbsp; สกุล ${wordLineFill(lastName, '....................................')} &nbsp;&nbsp; รหัสประจำตัวนักศึกษา ${wordLineFill(item.student_id, '........................')}</div>
        <div style="margin-bottom:12px;">ระดับ ${wordLineFill(item.level, '..............................')} &nbsp;&nbsp; กลุ่ม/กศน.ตำบล ${wordLineFill(item.group_name || '-', '..................................................')}</div>
        <div style="margin-bottom:36px;">ครูรับผิดชอบ ${wordLineFill(item.teacher_name, '........................................................................')}</div>
        <div style="text-align:center; margin-bottom:50px;">ลงชื่อ............................................................นักศึกษา<br>( ${esc(item.student_name)} )<br>${blankDateLine}</div>
        <table border="0" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:50%; text-align:center; vertical-align:top;">ลงชื่อ..........................................ผู้รับลงทะเบียน<br>( ${esc(item.teacher_name)} )<br>${blankDateLine}</td>
            <td style="width:50%; text-align:center; vertical-align:top;">ลงชื่อ..........................................นายทะเบียน<br>( ${regNameDisplay} )<br>${blankDateLine}</td>
          </tr>
        </table>
      </div>
      ${wordPageBreak()}
      <div style="line-height:1.38; font-size:14.5pt;">
        <div style="text-align:right; font-weight:bold; font-size:15pt;">กพช. 2</div>
        <div style="text-align:center; font-weight:bold; font-size:17pt; margin-bottom:6px;">แบบประเมินตนเองกิจกรรมพัฒนาคุณภาพชีวิต</div>
        <div style="font-weight:bold; font-size:15pt; margin-bottom:4px;">ส่วนที่ 1 สำหรับผู้เรียน</div>
        <div style="margin-bottom:10px; line-height:1.5;">
          <div>ชื่อสถานศึกษา &nbsp; ${wordLineFill(SCHOOL_NAME, '................................................................................')}</div>
          <div>ชื่อ-สกุล &nbsp; ${wordLineFill(item.student_name, '..................................................')} &nbsp;&nbsp; รหัสประจำตัวนักศึกษา &nbsp; ${wordLineFill(item.student_id, '........................')}</div>
          <div>ระดับการศึกษา &nbsp; ${wordLineFill(item.level, '......................................')} &nbsp;&nbsp; ศูนย์การเรียน &nbsp; ${wordLineFill(item.group_name || '-', '........................................')}</div>
          <div>ครูผู้รับผิดชอบ &nbsp; ${wordLineFill(item.teacher_name, '........................................................................')}</div>
        </div>
        <table border="1" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse; font-size:13.5pt;">
          <thead>
            <tr>
              <th rowspan="2" style="border:1px solid #000; width:6%; text-align:center; padding:4px;">ที่</th>
              <th rowspan="2" style="border:1px solid #000; width:56%; text-align:center; padding:4px;">รายการ</th>
              <th colspan="3" style="border:1px solid #000; width:26%; text-align:center; padding:4px;">ระดับความรู้ความเข้าใจ</th>
              <th rowspan="2" style="border:1px solid #000; width:12%; text-align:center; padding:4px;">หมายเหตุ</th>
            </tr>
            <tr>
              <th style="border:1px solid #000; text-align:center; padding:4px;">มาก</th>
              <th style="border:1px solid #000; text-align:center; padding:4px;">ปานกลาง</th>
              <th style="border:1px solid #000; text-align:center; padding:4px;">น้อย</th>
            </tr>
          </thead>
          <tbody>${evalRowsWord}</tbody>
        </table>
        <div style="text-align:center; margin:12px 0; font-size:15pt;">ลงชื่อ........................................................ผู้เรียน<br>( ${esc(item.student_name)} )</div>
        <div style="font-size:15pt; margin-bottom:12px;">
          <b>ส่วนที่ 2 สำหรับสถานศึกษา</b> &nbsp;&nbsp;
          ${passChecked ? '&#9745;' : '&#9744;'} ผ่าน &nbsp;&nbsp;&nbsp;
          ${rejectChecked ? '&#9745;' : '&#9744;'} เพิ่มเติมในเรื่อง &nbsp; ${wordLineFill(rejectChecked ? item.reject_reason_12 : '', '............................................................')}
        </div>
        <div style="text-align:center; font-size:15pt;">ลงชื่อ........................................................ครูผู้รับผิดชอบ<br>( ${esc(item.teacher_name)} )</div>
      </div>`;
  }

  const dotsStr = '.'.repeat(120);
  const dotSpan = `<span style="flex:1; min-width:12px; overflow:hidden; white-space:nowrap; letter-spacing:1px;">${dotsStr}</span>`;
  const makeDotFlex = (val, extraStyle = '') => {
    const clean = esc(val);
    return !clean ? `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>` : `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`;
  };
  const makeDotInline = (val, extraStyle = '') => {
    const clean = esc(val);
    return !clean ? `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>` : `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`;
  };
  const evalRowsHtml = EVAL_QUESTIONS_12.map((q, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${q}</td><td style="text-align:center; font-weight:bold;">${scores[i] === 'มาก' ? '✓' : ''}</td><td style="text-align:center; font-weight:bold;">${scores[i] === 'ปานกลาง' ? '✓' : ''}</td><td style="text-align:center; font-weight:bold;">${scores[i] === 'น้อย' ? '✓' : ''}</td><td></td></tr>`).join('');

  return `
    <div class="memo-page" style="padding: 10px 16px; line-height: 1.85; font-size: 16pt;">
      <div style="text-align:right; font-weight:bold; margin-bottom:12px;">กพช. 1</div>
      <div style="text-align:center; font-weight:bold; font-size:18pt; margin-bottom:12px;">แบบลงทะเบียนกิจกรรมพัฒนาคุณภาพชีวิต (รายบุคคล)</div>
      <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:8px;"><b>สถานศึกษา</b>${makeDotInline(SCHOOL_NAME, 'width:390px;')}</div>
      <div style="display:flex; justify-content:center; align-items:center; gap:6px; margin-bottom:26px;"><b>ภาคเรียนที่</b>${makeDotInline(termObj.no, 'width:65px;')}<span>/</span>${makeDotInline(termObj.year, 'width:95px;')}</div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;"><span>ชื่อ</span>${makeDotFlex(firstName)}<span>สกุล</span>${makeDotFlex(lastName)}<span>รหัสประจำตัวนักศึกษา</span>${makeDotFlex(item.student_id, 'flex:0.9;')}</div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;"><span>ระดับ</span>${makeDotFlex(item.level)}<span>กลุ่ม/กศน.ตำบล</span>${makeDotFlex(item.group_name || '-', 'flex:1.3;')}</div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:40px;"><span>ครูรับผิดชอบ</span>${makeDotFlex(item.teacher_name)}</div>
      <div style="text-align:center; margin-bottom:60px;">ลงชื่อ${makeDotInline('', 'width:200px; margin:0 6px;')}นักศึกษา<br>( ${esc(item.student_name)} )<br><span style="letter-spacing:1px;">${blankDateLine}</span></div>
      <div style="display:flex; justify-content:space-between; text-align:center;">
        <div style="width:48%;">ลงชื่อ${makeDotInline('', 'width:140px; margin:0 6px;')}ผู้รับลงทะเบียน<br>( ${esc(item.teacher_name)} )<br><span style="letter-spacing:1px;">${blankDateLine}</span></div>
        <div style="width:48%;">ลงชื่อ${makeDotInline('', 'width:140px; margin:0 6px;')}นายทะเบียน<br>( ${regNameDisplay} )<br><span style="letter-spacing:1px;">${blankDateLine}</span></div>
      </div>
    </div>
    <div style="padding: 4px 8px; line-height: 1.38;">
      <div style="text-align:right; font-weight:bold; font-size:15pt;">กพช. 2</div>
      <div style="text-align:center; font-weight:bold; font-size:17pt; margin-bottom:6px;">แบบประเมินตนเองกิจกรรมพัฒนาคุณภาพชีวิต</div>
      <div style="font-weight:bold; font-size:15pt; margin-bottom:4px;">ส่วนที่ 1 สำหรับผู้เรียน</div>
      <div style="font-size:14.5pt; margin-bottom:10px;">
        <div style="display:flex; gap:10px; margin-bottom:5px;"><span>ชื่อสถานศึกษา</span>${makeDotFlex(SCHOOL_NAME)}</div>
        <div style="display:flex; gap:10px; margin-bottom:5px;"><span>ชื่อ-สกุล</span>${makeDotFlex(item.student_name)}<span>รหัสประจำตัวนักศึกษา</span>${makeDotFlex(item.student_id, 'flex:0.8;')}</div>
        <div style="display:flex; gap:10px; margin-bottom:5px;"><span>ระดับการศึกษา</span>${makeDotFlex(item.level)}<span>ศูนย์การเรียน</span>${makeDotFlex(item.group_name || '-')}</div>
        <div style="display:flex; gap:10px;"><span>ครูผู้รับผิดชอบ</span>${makeDotFlex(item.teacher_name)}</div>
      </div>
      <table class="batch-table" style="font-size:13.5pt !important;"><thead><tr><th rowspan="2" style="width:5%;">ที่</th><th rowspan="2" style="width:57%;">รายการ</th><th colspan="3" style="width:26%;">ระดับความรู้ความเข้าใจ</th><th rowspan="2" style="width:12%;">หมายเหตุ</th></tr><tr><th>มาก</th><th>ปานกลาง</th><th>น้อย</th></tr></thead><tbody>${evalRowsHtml}</tbody></table>
      <div style="text-align:center; margin:12px 0; font-size:15pt;">ลงชื่อ${makeDotInline('', 'width:190px; margin:0 6px;')}ผู้เรียน<br>( ${esc(item.student_name)} )</div>
      <div style="display:flex; align-items:center; gap:10px; font-size:15pt; margin-bottom:12px;">
        <b>ส่วนที่ 2 สำหรับสถานศึกษา</b>
        <span><span style="display:inline-block; width:16px; height:16px; border:1px solid #000; text-align:center;">${passChecked ? '✓' : '&nbsp;'}</span> ผ่าน</span>
        <span><span style="display:inline-block; width:16px; height:16px; border:1px solid #000; text-align:center;">${rejectChecked ? '✓' : '&nbsp;'}</span> เพิ่มเติมในเรื่อง</span>
        ${makeDotFlex(rejectChecked ? item.reject_reason_12 : '', 'min-width:150px;')}
      </div>
      <div style="text-align:center; font-size:15pt;">ลงชื่อ${makeDotInline('', 'width:190px; margin:0 6px;')}ครูผู้รับผิดชอบ<br>( ${esc(item.teacher_name)} )</div>
    </div>`;
}

// ==================== ล็อคอิน / หลังบ้าน (3 ขั้นตอน) ====================
function resetDashboardTabViews() {
  document.getElementById('dashSubmissionsView').classList.remove('d-none');
  document.getElementById('dash12View').classList.add('d-none');
  document.getElementById('adminCategoriesView')?.classList.add('d-none');
  document.getElementById('adminUsersView').classList.add('d-none');
  document.getElementById('adminAnnView').classList.add('d-none');
  document.getElementById('adminLogsView').classList.add('d-none');
  document.getElementById('adminTrashView')?.classList.add('d-none');
  document.querySelectorAll('#adminNavTabs button, #teacherNavTabs button').forEach((b, idx) => b.classList.toggle('active', idx === 0));
}

async function handleLogin() {
  const u = document.getElementById('loginUser').value.trim(), p = document.getElementById('loginPass').value;
  if (!u || !p) return safeAlert('แจ้งเตือน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning');
  showLoading('กำลังเข้าสู่ระบบ...');
  try {
    const res = await callApi('login', { username: u, password: p });
    hideLoading(); authToken = res.token; currentUser = res.user;
    sessionStorage.setItem('kpch_token', authToken); closeModalById('loginModal'); document.getElementById('loginPass').value = '';
    teacherTabMode = 'sub'; resetDashboardTabViews();
    await loadDashboard();
  } catch (err) { hideLoading(); safeAlert('เข้าสู่ระบบไม่สำเร็จ', err.message, 'error'); }
}

function handleLogout() {
  if (authToken) callApi('logout', { token: authToken }).catch(() => {});
  authToken = null; currentUser = null; dashItems = []; dash12Items = [];
  sessionStorage.removeItem('kpch_token');
  document.getElementById('dashboardSection').classList.add('d-none');
  document.getElementById('publicSection').classList.remove('d-none');
  resetDashboardTabViews(); renderNavbar(); loadPublicData();
}

function updateSubmissionsBarsVisibility() {
  if (!currentUser) return;
  const isTeacher = currentUser.role === 'TEACHER';
  const isReg = currentUser.role === 'REGISTRAR';
  const isAdmin = currentUser.role === 'ADMIN';
  const canCheck = ['TEACHER', 'REGISTRAR', 'ADMIN'].includes(currentUser.role);

  document.getElementById('subFilterRow').classList.remove('d-none');
  document.getElementById('dashTeacherFilterWrap').classList.toggle('d-none', !(isReg || isAdmin));
  document.getElementById('teacherSubActionBar').classList.toggle('d-none', !(isTeacher || isAdmin));
  document.getElementById('registrarTools').classList.toggle('d-none', !(isReg || isAdmin));
  document.getElementById('adminDeleteSubBar')?.classList.toggle('d-none', !isAdmin);
  document.getElementById('thCheckbox').classList.toggle('d-none', !canCheck);
  document.getElementById('mobileCheckAllSubWrap').classList.toggle('d-none', !canCheck);
}

function renderAdminAnnPdfBox(ann) {
  const box = document.getElementById('annCurrentPdfBox'), fileInput = document.getElementById('ann_pdf_file');
  if (fileInput) fileInput.value = ''; if (!box) return;
  if (ann && ann.pdf_url) {
    box.classList.remove('d-none');
    box.innerHTML = `<div class="alert alert-light border d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 mb-0 rounded-3 small"><div><i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i><b>ไฟล์แนบปัจจุบัน:</b> <a href="${esc(ann.pdf_url)}" target="_blank">${esc(ann.pdf_name || 'PDF')}</a></div><div class="form-check mb-0"><input class="form-check-input" type="checkbox" id="ann_remove_pdf"><label class="form-check-label text-danger fw-semibold" for="ann_remove_pdf">ลบไฟล์ PDF นี้ออก</label></div></div>`;
  } else { box.classList.add('d-none'); box.innerHTML = ''; }
}

async function loadDashboard(silentOnExpire = false) {
  showLoading('กำลังโหลดข้อมูลหลังบ้าน...');
  try {
    const res = await callApi('getDashboard', { token: authToken });
    hideLoading();
    currentUser = res.user; dashItems = res.items || []; dash12Items = res.items12 || [];
    if (res.categories) { kpchCategories = res.categories; populateCategorySelects(); }
    registrarName = res.registrar_name || ''; adminUsers = res.users || []; adminLogs = res.logs || [];
    adminTrashSubs = res.trash_submissions || []; adminTrash12 = res.trash_approvals12 || [];

    document.getElementById('publicSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    renderNavbar();
    document.getElementById('dashTitle').innerText = `หลังบ้าน: ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
    document.getElementById('dashSubtitle').innerText = `สวัสดีคุณ ${currentUser.full_name} (${currentUser.group_name || '-'})`;

    const isAdmin = currentUser.role === 'ADMIN', isTeacher = currentUser.role === 'TEACHER';
    document.getElementById('adminNavTabs').classList.toggle('d-none', !isAdmin);
    document.getElementById('teacherNavTabs').classList.toggle('d-none', !isTeacher);
    document.getElementById('adminDelete12Bar')?.classList.toggle('d-none', !isAdmin);

    if (isTeacher) {
      const waitSub = dashItems.filter(x => x.current_step === 'WAIT_TEACHER').length;
      const wait12 = dash12Items.filter(x => x.status_12 === 'WAIT_TEACHER_12').length;
      const bSub = document.getElementById('badgeWaitSub'), b12 = document.getElementById('badgeWait12');
      bSub.innerText = waitSub; bSub.classList.toggle('d-none', waitSub === 0);
      b12.innerText = wait12; b12.classList.toggle('d-none', wait12 === 0);
    }

    const badgeTrash = document.getElementById('badgeTrashCount');
    if (isAdmin) {
      renderAdminCategories(); renderAdminUsers(); renderAdminLogs(); renderAdminTrash();
      const totalTrash = adminTrashSubs.length + adminTrash12.length;
      if (badgeTrash) { badgeTrash.innerText = totalTrash; badgeTrash.classList.toggle('d-none', totalTrash === 0); }
      if (res.announcement) {
        document.getElementById('ann_visible').checked = !!res.announcement.visible;
        document.getElementById('ann_badge').value = res.announcement.badge || '';
        document.getElementById('ann_content').value = res.announcement.content || '';
        renderAdminAnnPdfBox(res.announcement);
      }
    } else {
      adminTrashSubs = []; adminTrash12 = [];
      if (badgeTrash) { badgeTrash.innerText = '0'; badgeTrash.classList.add('d-none'); }
      document.getElementById('adminTrashView')?.classList.add('d-none');
    }

    if (!isAdmin && !isTeacher) { teacherTabMode = 'sub'; resetDashboardTabViews(); }
    populateTermDropdown(document.getElementById('dashTermFilter'), dashItems, getItemTerm);
    populateTermDropdown(document.getElementById('dash12TermFilter'), dash12Items, x => formatTermText(x.term));
    populateDashTeacherFilter();
    updateSubmissionsBarsVisibility();
    renderDashboardList();
    if (isTeacher || isAdmin) render12List();
  } catch (err) {
    hideLoading();
    if (silentOnExpire) {
      authToken = null; sessionStorage.removeItem('kpch_token');
      renderNavbar();
      loadPublicData();
    } else safeAlert('ผิดพลาด', err.message, 'error');
  }
}

function switchTeacherTab(tab, btn) {
  teacherTabMode = tab;
  document.querySelectorAll('#teacherNavTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dashSubmissionsView').classList.toggle('d-none', tab !== 'sub');
  document.getElementById('dash12View').classList.toggle('d-none', tab !== 'req12');
  if (tab === 'sub') { updateSubmissionsBarsVisibility(); renderDashboardList(); }
}

function setFilterMode(mode, btn) {
  filterMode = mode;
  document.querySelectorAll('#filterStatusBtns button').forEach(b => { b.classList.remove('btn-primary', 'active'); b.classList.add('btn-outline-secondary'); });
  btn.classList.remove('btn-outline-secondary'); btn.classList.add('btn-primary', 'active');
  renderDashboardList();
}

function setFilter12Mode(mode, btn) {
  filter12Mode = mode;
  document.querySelectorAll('#filter12Btns button').forEach(b => { b.classList.remove('btn-primary', 'active'); b.classList.add('btn-outline-secondary'); });
  btn.classList.remove('btn-outline-secondary'); btn.classList.add('btn-primary', 'active');
  render12List();
}

function isMyPendingItem(item) {
  if (!currentUser) return true;
  if (currentUser.role === 'TEACHER' || currentUser.role === 'ADMIN') return item.current_step === 'WAIT_TEACHER';
  if (currentUser.role === 'REGISTRAR') return item.current_step === 'APPROVED_FOR_REGISTRAR';
  return true;
}

// ==================== บันทึกสถานะ "ปริ้นแล้ว" ====================
async function markPrintedClient(docType, ids) {
  if (!authToken || !ids || ids.length === 0) return;
  try {
    const res = await callApi('markPrinted', { token: authToken, doc_type: docType, ids });
    const ts = res.printed_at || 'ปริ้นแล้ว';
    if (docType === '12') {
      dash12Items.forEach(x => { if (ids.includes(x.req12_id)) x.printed_12_at = ts; });
      render12List();
    } else if (docType === '3') {
      dash12Items.forEach(x => { if (ids.includes(x.req12_id)) x.printed_3_at = ts; });
      render12List();
    } else if (docType === '46') {
      dashItems.forEach(x => { if (ids.includes(x.req_id)) x.printed_46_at = ts; });
      renderDashboardList();
    }
  } catch (e) { console.warn('markPrinted error:', e); }
}
// ==================== ตาราง กพช. 1-2 & พิมพ์ / โหลด Word กพช. 3 ====================
function toggleAll12Checks(master) {
  document.querySelectorAll('.chk-12').forEach(cb => cb.checked = master.checked);
}

function render12List() {
  const kw = (document.getElementById('dash12SearchInput')?.value || '').toLowerCase().trim();
  const termVal = document.getElementById('dash12TermFilter')?.value || 'ALL';
  const catVal = document.getElementById('dash12CategoryFilter')?.value || 'ALL';
  const printVal = document.getElementById('dash12PrintFilter')?.value || 'ALL';
  const isAdmin = currentUser?.role === 'ADMIN';

  const filtered = dash12Items.filter(item => {
    if (filter12Mode === 'PENDING' && item.status_12 !== 'WAIT_TEACHER_12') return false;
    if (!matchesTermFilter(formatTermText(item.term), termVal)) return false;
    if (catVal !== 'ALL' && String(item.category || '').trim() !== catVal) return false;
    if (printVal === 'NOT_12' && !!item.printed_12_at) return false;
    if (printVal === 'DONE_12' && !item.printed_12_at) return false;
    if (printVal === 'NOT_3' && !!item.printed_3_at) return false;
    if (printVal === 'DONE_3' && !item.printed_3_at) return false;
    if (kw) {
      const text = `${item.req12_id} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.category || ''} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });
  currentFiltered12 = filtered;

  const tbody = document.getElementById('dash12TableBody'), mobileBox = document.getElementById('dash12MobileCards'), masterCb = document.getElementById('checkAll12Box');
  if (masterCb) masterCb.checked = false;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">ไม่มีคำขอ กพช.1-2 ในหมวดหมู่นี้</td></tr>`;
    mobileBox.innerHTML = `<div class="text-center py-4 text-muted">ไม่มีคำขอ กพช.1-2 ในหมวดหมู่นี้</div>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
    const canAct = item.status_12 === 'WAIT_TEACHER_12';
    const b12 = item.printed_12_at ? `<span class="badge bg-success bg-opacity-15 text-success border border-success me-1">✅ ปริ้น 1-2 แล้ว</span>` : '';
    const b3 = item.printed_3_at ? `<span class="badge bg-primary bg-opacity-15 text-primary border border-primary">✅ ปริ้น 3 แล้ว</span>` : '';
    return `
      <tr>
        <td><input type="checkbox" class="chk-12" value="${esc(item.req12_id)}" onchange="syncCheckPair(this, 'chk-12')"></td>
        <td><div class="fw-bold text-primary">${esc(item.req12_id)}</div><div class="small text-muted">${esc(item.created_at)}</div></td>
        <td><div class="fw-semibold">${esc(item.student_name)}</div><div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div></td>
        <td class="small">${item.category ? `<span class="badge bg-info bg-opacity-10 text-dark border mb-1">${esc(item.category)}</span><br>` : ''}ภาค: ${esc(formatTermText(item.term))}</td>
        <td><div class="fw-semibold">${esc(item.activity_name)}</div><div class="small text-muted">${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)} ${item.role_note ? `| <b>${esc(item.role_note)}</b>` : ''}</div></td>
        <td><span class="badge step-badge ${st.cls}">${st.text}</span><div class="mt-1">${b12}${b3}</div></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" onclick="open12DetailModal('${escJs(item.req12_id)}')"><i class="bi bi-eye"></i> ${canAct ? 'ตรวจ/อนุมัติ' : 'ดูข้อมูล'}</button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill ms-1" title="พิมพ์หรือดาวน์โหลด Word กพช.1-2" onclick="printForm12('${escJs(item.req12_id)}')"><i class="bi bi-printer"></i> กพช.1-2</button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="confirmDelete12(['${escJs(item.req12_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`;
  }).join('');

  mobileBox.innerHTML = filtered.map(item => {
    const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
    const canAct = item.status_12 === 'WAIT_TEACHER_12';
    const b12 = item.printed_12_at ? `<span class="badge bg-success bg-opacity-15 text-success border border-success ms-1">✅ 1-2</span>` : '';
    const b3 = item.printed_3_at ? `<span class="badge bg-primary bg-opacity-15 text-primary border border-primary ms-1">✅ 3</span>` : '';
    return `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div><input type="checkbox" class="chk-12 me-2" value="${esc(item.req12_id)}" onchange="syncCheckPair(this, 'chk-12')"><span class="fw-bold text-primary">${esc(item.req12_id)}</span>${b12}${b3}</div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-2"><b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)}) | <b>ประเภท:</b> ${esc(item.category || '-')}</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm rounded-pill flex-fill fw-bold" onclick="open12DetailModal('${escJs(item.req12_id)}')"><i class="bi bi-eye me-1"></i>${canAct ? 'ตรวจ / อนุมัติ' : 'ดูรายละเอียด'}</button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="printForm12('${escJs(item.req12_id)}')"><i class="bi bi-printer"></i> กพช.1-2</button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDelete12(['${escJs(item.req12_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function confirmBatchApprove12() {
  const ids = getCheckedUniqueIds('chk-12');
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการ กพช.1-2 อย่างน้อย 1 รายการครับ', 'warning');
  Swal.fire({ title: `อนุมัติ กพช.1-2 จำนวน ${ids.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยันอนุมัติทั้งหมด', confirmButtonColor: '#10b981' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังอนุมัติ...');
      try { const r = await callApi('batchApprove12', { token: authToken, req12_ids: ids }); hideLoading(); safeAlert('สำเร็จ 🎉', `อนุมัติเรียบร้อยแล้ว ${r.count} รายการ`, 'success'); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchReject12() {
  const ids = getCheckedUniqueIds('chk-12');
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการตีกลับอย่างน้อย 1 รายการ', 'warning');
  Swal.fire({
    title: `ตีกลับ กพช.1-2 (${ids.length} รายการ)`, input: 'textarea', inputLabel: 'ระบุเหตุผลในการตีกลับให้นักศึกษาทราบ',
    inputPlaceholder: 'เช่น ชื่อกิจกรรมไม่ชัดเจน, เลือกประเภท กพช. ผิด...', showCancelButton: true, confirmButtonText: 'ยืนยันตีกลับ', confirmButtonColor: '#ef4444',
    inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลในการตีกลับด้วยครับ'; }
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังบันทึกการตีกลับ...');
      try { const r = await callApi('batchReject12', { token: authToken, req12_ids: ids, reason: res.value.trim() }); hideLoading(); safeAlert('ตีกลับเรียบร้อย', `ส่งคืนให้นักศึกษาแก้ไข ${r.count} รายการแล้ว`, 'success'); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchDelete12() {
  const ids = getCheckedUniqueIds('chk-12');
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการย้ายลงถังขยะ', 'warning');
  confirmDelete12(ids);
}

function confirmDelete12(req12Ids) {
  if (!currentUser || currentUser.role !== 'ADMIN') return safeAlert('ไม่มีสิทธิ์', 'เฉพาะ Admin เท่านั้น', 'error');
  Swal.fire({ title: `ย้ายข้อมูล กพช.1-2 (${req12Ids.length} รายการ) ลงถังขยะ?`, icon: 'warning', showCancelButton: true, confirmButtonText: '🗑️ ย้ายลงถังขยะ', confirmButtonColor: '#dc2626' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังย้ายลงถังขยะ...');
      try { const r = await callApi('deleteApprovals12', { token: authToken, req12_ids: req12Ids }); hideLoading(); closeModalById('detailModal'); safeAlert('เรียบร้อย 🗑️', `ย้ายลงถังขยะแล้ว ${r.count} รายการ`, 'success'); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function openDoc56ById(req12Id) {
  const found = dash12Items.find(x => x.req12_id === req12Id);
  if (!found) return;
  closeModalById('detailModal');
  setTimeout(() => openDoc56ModalWithItems([found]), 220);
}

function open12DetailModal(req12Id) {
  const item = dash12Items.find(x => x.req12_id === req12Id);
  if (!item) return;
  let scores = [];
  try { scores = JSON.parse(item.eval_scores || '[]'); } catch (e) {}
  const scorePreview = EVAL_QUESTIONS_12.map((q, i) => `<tr><td class="text-center">${i + 1}</td><td>${q}</td><td class="text-center fw-bold text-primary">${esc(scores[i] || '-')}</td></tr>`).join('');
  document.getElementById('mdReqId').innerText = item.req12_id;
  const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
  document.getElementById('detailModalBody').innerHTML = `
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2"><span class="badge step-badge ${st.cls}">${st.text}</span><span class="text-muted small">ยื่นขอเมื่อ: ${esc(item.created_at)}</span></div>
    <div class="row g-2 mb-3 bg-light p-3 rounded-3 small">
      <div class="col-12 col-md-6"><b>นักศึกษา:</b> ${esc(item.student_name)} (${esc(item.student_id)})</div>
      <div class="col-12 col-md-6"><b>ระดับชั้น:</b> ${esc(item.level)} | <b>ภาคเรียน:</b> ${esc(formatTermText(item.term))}</div>
      <div class="col-12 col-md-6"><b>ประเภท กพช.:</b> ${esc(item.category || '-')}</div>
      <div class="col-12 col-md-6"><b>บทบาท (กพช.3):</b> ${esc(item.role_note || 'ผู้เข้าร่วมโครงการ')}</div>
      <div class="col-12 col-md-6"><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</div>
      <div class="col-12 col-md-6"><b>กลุ่ม/ศูนย์การเรียน:</b> ${esc(item.group_name || '-')}</div>
      <div class="col-12 col-md-6"><b>ช่วงเวลา:</b> ${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)}</div>
      <div class="col-12 col-md-6"><b>สถานที่:</b> ${esc(item.location || '-')}</div>
    </div>
    <h6 class="fw-bold">ชื่อกิจกรรม / โครงการที่จะทำ:</h6><p>${esc(item.activity_name)}</p>
    <h6 class="fw-bold mt-3">ผลประเมินตนเอง (กพช. 2) ทั้ง 10 ข้อ:</h6>
    <div class="table-responsive mb-2"><table class="table table-bordered table-sm small mb-0"><thead class="table-light"><tr><th style="width:40px;">ที่</th><th>รายการ</th><th style="width:85px;" class="text-center">ระดับ</th></tr></thead><tbody>${scorePreview}</tbody></table></div>
    ${item.approved_at_12 ? `<div class="small text-success fw-bold">✅ อนุมัติ กพช.1-2 เมื่อ: ${esc(item.approved_at_12)}</div>` : ''}
    ${item.reject_reason_12 ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(item.reject_reason_12)}</div>` : ''}
  `;
  const canAct = item.status_12 === 'WAIT_TEACHER_12' && ['TEACHER', 'ADMIN'].includes(currentUser.role);
  const isApproved = item.status_12 === 'APPROVED_12', isAdmin = currentUser.role === 'ADMIN';
  document.getElementById('detailModalFooter').innerHTML = `
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="printForm12('${escJs(item.req12_id)}')"><i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word กพช. 1-2</button>
      ${isApproved ? `<button type="button" class="btn btn-primary btn-sm rounded-pill px-3" onclick="openDoc56ById('${escJs(item.req12_id)}')"><i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word กพช. 3 + บันทึก</button>` : ''}
      ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDelete12(['${escJs(item.req12_id)}'])"><i class="bi bi-trash me-1"></i>ย้ายลงถังขยะ</button>` : ''}
    </div>
    <div class="d-flex flex-wrap gap-2">
      ${canAct ? `<button type="button" class="btn btn-danger rounded-pill px-3 fw-bold" onclick="submitDecision12('${escJs(item.req12_id)}', 'REJECT')"><i class="bi bi-x-circle me-1"></i>ตีกลับ (ระบุเหตุผล)</button><button type="button" class="btn btn-success rounded-pill px-3 fw-bold" onclick="submitDecision12('${escJs(item.req12_id)}', 'APPROVE')"><i class="bi bi-check-circle me-1"></i>อนุมัติ กพช.1-2</button>` : ''}
      <button type="button" class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">ปิด</button>
    </div>`;
  openModalById('detailModal');
}

function submitDecision12(req12Id, decision) {
  closeModalById('detailModal');
  setTimeout(() => {
    if (decision === 'APPROVE') {
      Swal.fire({ title: 'อนุมัติคำขอ กพช.1-2?', text: `อนุญาตให้นักศึกษาดำเนินกิจกรรมตามคำขอ ${req12Id} ใช่หรือไม่`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยันอนุมัติ', confirmButtonColor: '#10b981' }).then(res => { if (res.isConfirmed) executeApproval12(req12Id, 'APPROVE', ''); });
    } else {
      Swal.fire({ title: 'ระบุเหตุผลในการตีกลับ กพช.1-2', input: 'textarea', inputPlaceholder: 'เช่น ชื่อกิจกรรมไม่ชัดเจน / เลือกประเภท กพช. ผิด...', showCancelButton: true, confirmButtonText: 'ส่งตีกลับ', confirmButtonColor: '#ef4444', inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; } }).then(res => { if (res.isConfirmed) executeApproval12(req12Id, 'REJECT', res.value); });
    }
  }, 220);
}

async function executeApproval12(req12Id, decision, reason) {
  showLoading('กำลังบันทึกผล กพช.1-2...');
  try { await callApi('processApproval12', { token: authToken, req12_id: req12Id, decision, reason }); hideLoading(); safeAlert('สำเร็จ', 'บันทึกผลการพิจารณา กพช.1-2 เรียบร้อยแล้ว', 'success'); await loadDashboard(); }
  catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function printForm12(req12Id) {
  const item = dash12Items.find(x => x.req12_id === req12Id);
  if (!item) return;
  choosePrintOrWord(
    `กพช.1-2 (${item.req12_id})`,
    () => {
      document.getElementById('printOnlyContainer').innerHTML = buildKPCH12Html(item, false);
      markPrintedClient('12', [req12Id]);
      triggerPrint();
    },
    () => {
      markPrintedClient('12', [req12Id]);
      exportHtmlToWord(`กพช1-2_${item.student_id || 'doc'}_${item.req12_id}`, buildKPCH12Html(item, true));
    }
  );
}

// ==================== พิมพ์ / โหลด Word ชุด กพช. 3 + บันทึกข้อความ ====================
function openDoc56PrintModal() {
  const checkedIds = getCheckedUniqueIds('chk-12');
  if (checkedIds.length === 0) {
    return safeAlert('กรุณาติ๊กเลือกรายชื่อ', 'กรุณาติ๊กถูกหน้ารายชื่อนักศึกษาที่ต้องการพิมพ์ กพช. 3 อย่างน้อย 1 คนก่อนครับ', 'warning');
  }
  const items = dash12Items.filter(x => checkedIds.includes(x.req12_id));
  const notApproved = items.filter(x => x.status_12 !== 'APPROVED_12');
  if (notApproved.length > 0) {
    return safeAlert('ยังไม่ได้อนุมัติ กพช. 1-2', `รายการ <b>${esc(notApproved.map(x => x.req12_id).join(', '))}</b> ยังไม่ได้รับการอนุมัติ กพช. 1-2<br>กรุณากดอนุมัติ กพช. 1-2 ก่อน จึงจะออกเอกสาร กพช. 3 ได้ครับ`, 'warning');
  }
  openDoc56ModalWithItems(items);
}

function openDoc56ModalWithItems(items) {
  if (!items || !items[0]) return;
  _doc56Items = items;
  const first = items[0], catObj = kpchCategories.find(c => c.cat_name === first.category);
  document.getElementById('d56_count').innerText = items.length;
  document.getElementById('d56_doc_no').value = 'ศธ 07058.02/';
  document.getElementById('d56_doc_date').value = formatThaiDate();
  document.getElementById('d56_advisor_pos').value = 'บรรณารักษ์ / ครูประจำกลุ่ม';
  document.getElementById('d56_project_name').value = first.activity_name || '';
  document.getElementById('d56_hours').value = (catObj && catObj.default_hours) ? catObj.default_hours : (first.hours || 25);
  document.getElementById('d56_rationale').value = (catObj && catObj.default_rationale) ? catObj.default_rationale : 'กิจกรรมพัฒนาคุณภาพชีวิต (กพช.) เป็นกิจกรรมที่เป็นองค์ประกอบสำคัญส่วนหนึ่งในโครงสร้างที่กำหนดไว้ในหลักเกณฑ์ และวิธีการจัดการศึกษานอกระบบระดับการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 มุ่งเน้นให้เกิดการพัฒนาตนเอง ครอบครัว ชุมชน สังคมและประเทศชาติ เพื่อให้ดำรงอยู่ในสังคมอย่างมีความสุข';
  document.getElementById('d56_objectives').value = '3.1 เพื่อเป็นการเปลี่ยนแปลงในการพัฒนาตนเอง ให้มีระเบียบ วินัย และการเสียสละ\n3.2 เพื่อส่งเสริมให้เป็นผู้มีน้ำใจ เสียสละ ในการพัฒนาตนเอง ครอบครัว ชุมชน สังคมและประเทศชาติ';
  document.getElementById('d56_target').value = 'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย';
  document.getElementById('d56_steps').value = '5.1 วางแผนการจัดกิจกรรม\n5.2 ปรึกษาอาจารย์ที่ปรึกษา\n5.3 เข้าร่วมโครงการ\n5.4 เสนอโครงการการจัดกิจกรรมฯ ต่อสถานศึกษาเพื่อให้คณะกรรมการพิจารณาอนุมัติโครงการ\n5.5 ดำเนินจัดกิจกรรมตามแผนที่กำหนด สรุปผลและรายงานผลการดำเนินงาน\n5.6 สรุปผลและรายงานผลการดำเนินงาน และขออนุมัติชั่วโมง กพช.';
  document.getElementById('d56_location').value = first.location || 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง จังหวัดปทุมธานี';
  document.getElementById('d56_start_date').value = toInputDate(first.plan_start_date);
  document.getElementById('d56_end_date').value = toInputDate(first.plan_end_date);
  document.getElementById('d56_budget').value = '-';
  document.getElementById('d56_material').value = 'หนังสือ / อุปกรณ์การทำกิจกรรม';
  document.getElementById('d56_labor').value = 'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง';
  document.getElementById('d56_expected').value = 'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง ได้รับการพัฒนาตนเอง ในด้านการคิด การกระทำ และการฝึกบันทึก สามารถนำความรู้และประสบการณ์ที่ได้รับมาประยุกต์ใช้ในชีวิตประจำวัน';
  document.getElementById('d56_advisor').value = first.teacher_name || (currentUser?.full_name || '');
  document.getElementById('d56_comm1').value = COMM_1_NAME;
  document.getElementById('d56_comm2').value = COMM_2_NAME;
  document.getElementById('d56_comm3').value = COMM_3_NAME;
  document.getElementById('d56_director').value = DIRECTOR_NAME;
  openModalById('doc56Modal');
}

function buildDoc56Html(items, cfg, forWord = false, garudaSrc = GARUDA_URL) {
  const isGroup = items.length > 1;
  const leader = items.find(i => (i.role_note || '').includes('ประธาน')) || items[0];

  if (forWord) {
    const rowsWord = items.map((s, idx) => `
      <tr>
        <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${idx + 1}</td>
        <td style="border:1px solid #000; padding:3px 6px;">${esc(s.student_name)}</td>
        <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${esc(s.student_id)}</td>
        <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${esc(s.role_note || (idx === 0 && isGroup ? 'ประธาน' : ''))}</td>
        <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${esc(s.level || '')}</td>
      </tr>`).join('');

    const memo56Word = `
      <div style="font-size:15.5pt; line-height:1.45;">
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td style="width:72px; vertical-align:bottom;"><img src="${esc(garudaSrc)}" width="58" style="width:58px; height:auto;" /></td>
            <td style="text-align:center; vertical-align:bottom; font-size:24pt; font-weight:bold;">บันทึกข้อความ</td>
            <td style="width:72px;"></td>
          </tr>
        </table>
        <div style="margin-bottom:3px;"><b>ส่วนราชการ</b> &nbsp; ${SCHOOL_NAME} &nbsp;&nbsp; <b>โทร.</b> 02 524 0645</div>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-bottom:3px;">
          <tr>
            <td style="width:55%;"><b>ที่</b> &nbsp; ${esc(cfg.docNo)}</td>
            <td style="width:45%;"><b>วันที่</b> &nbsp; ${esc(cfg.docDate)}</td>
          </tr>
        </table>
        <div style="margin-bottom:4px;"><b>เรื่อง</b> &nbsp; ขออนุมัติโครงการกิจกรรมพัฒนาคุณภาพชีวิต</div>
        <div style="border-bottom:1.5px solid #000; margin:6px 0 12px 0;">&nbsp;</div>
        <div style="margin-bottom:10px;"><b>เรียน</b> &nbsp; ผู้อำนวยการ${SCHOOL_NAME}</div>
        <p style="text-indent:2.5cm; margin:0 0 8px 0; text-align:justify;">ด้วยนักศึกษา ${SCHOOL_NAME} ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย จำนวน ${items.length} คน ได้เสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต โครงการ/กิจกรรม ${esc(cfg.projName)} ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate} สถานที่ปฏิบัติกิจกรรม ณ ${esc(cfg.loc)}</p>
        <p style="text-indent:2.5cm; margin:0 0 8px 0; text-align:justify;">ในการนี้ ข้าพเจ้า ได้ดำเนินการตรวจสอบแบบเสนอโครงการแล้ว ปรากฏว่ามีความครบถ้วน ถูกต้อง และเหมาะสมที่จะปฏิบัติได้</p>
        <p style="text-indent:2.5cm; margin:0 0 18px 0;">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:40%;"></td>
            <td style="width:60%; text-align:center; line-height:1.45;">
              ลงชื่อ..................................................<br>
              (${esc(cfg.advisor)})<br>
              ตำแหน่ง &nbsp;&nbsp; ${esc(cfg.advisorPos)}
            </td>
          </tr>
          <tr>
            <td style="width:35%;"></td>
            <td style="width:65%; padding-top:20px; line-height:1.6;">
              &#9744; อนุมัติ<br>
              &#9744; มอบคณะกรรมการตรวจสอบและประเมินค่าหน่วยกิจกรรม
            </td>
          </tr>
          <tr>
            <td style="width:40%;"></td>
            <td style="width:60%; text-align:center; padding-top:28px; line-height:1.45;">
              (${esc(cfg.director)})<br>
              ผู้อำนวยการ${SCHOOL_NAME}
            </td>
          </tr>
        </table>
      </div>`;

    const k3Word = `
      ${wordPageBreak()}
      <div style="line-height:1.35; font-size:14.5pt;">
        ${wordBoxTagHtml('กพช. 3')}
        <div style="text-align:center; font-weight:bold; font-size:17pt; margin-bottom:6px;">แบบเสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต (สำหรับผู้เรียน)</div>
        <div style="margin-top:4px;"><b>ส่วนที่ 1 สำหรับผู้เรียน</b> &nbsp;|&nbsp; เสนอต่อสถานศึกษา <b>${SCHOOL_NAME}</b></div>
        <div><b>1. ชื่อโครงการ</b> &nbsp; ${esc(cfg.projName)}</div>
        <div><b>2. หลักการและเหตุผล</b><div style="margin-left:1.5cm;">${esc(cfg.rationale).replace(/\n/g, '<br>')}</div></div>
        <div><b>3. วัตถุประสงค์</b><div style="margin-left:1.5cm;">${esc(cfg.objectives).replace(/\n/g, '<br>')}</div></div>
        <div><b>4. เป้าหมาย</b><div style="margin-left:1.5cm;">${esc(cfg.target).replace(/\n/g, '<br>')}</div></div>
        <div><b>5. ขั้นตอน/แผนการปฏิบัติโครงการ</b><div style="margin-left:1.5cm;">${esc(cfg.steps).replace(/\n/g, '<br>')}</div></div>
        <div><b>6. สถานที่ดำเนินการ</b> &nbsp; ${esc(cfg.loc)}</div>
        <div><b>7. ระยะเวลาการดำเนินโครงการ</b> &nbsp; ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate}</div>
        <div><b>8. ปัจจัยในการดำเนินโครงการ</b> &nbsp; 8.1 เงิน ${esc(cfg.budget)} &nbsp; 8.2 วัสดุ ${esc(cfg.material)} &nbsp; 8.3 แรงงาน ${esc(cfg.labor)}</div>
        <div style="margin-bottom:4px;"><b>9. ผลที่คาดว่าจะได้รับ</b><div style="margin-left:1.5cm;">${esc(cfg.expected).replace(/\n/g, '<br>')}</div></div>
        <div><b>10. ผู้รับผิดชอบโครงการ</b> ชื่อ ${isGroup ? '........................................' : esc(leader.student_name)} รหัส ${isGroup ? '........................' : esc(leader.student_id)} (กรณีเสนอเป็นรายบุคคล)</div>
        <div><b>11. ผู้รับผิดชอบโครงการ</b> จำนวน ${isGroup ? items.length : '............'} คน ได้แก่ ${isGroup ? esc(leader.student_name) + ' และคณะ' : '........................................'} (กรณีเสนอเป็นกลุ่ม)</div>
        <div style="text-align:center; font-weight:bold; margin-top:6px;">รายชื่อผู้เข้าร่วมทำ${esc(cfg.projName)}</div>
        <table border="1" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse; margin-top:4px; font-size:14pt;">
          <thead>
            <tr>
              <th style="border:1px solid #000; width:40px; text-align:center; padding:4px;">ที่</th>
              <th style="border:1px solid #000; text-align:center; padding:4px;">ชื่อ - สกุล</th>
              <th style="border:1px solid #000; width:125px; text-align:center; padding:4px;">รหัสนักศึกษา</th>
              <th style="border:1px solid #000; width:105px; text-align:center; padding:4px;">หมายเหตุ</th>
              <th style="border:1px solid #000; width:105px; text-align:center; padding:4px;">ระดับ</th>
            </tr>
          </thead>
          <tbody>${rowsWord}</tbody>
        </table>
        <div style="margin-top:6px;"><b>12. ที่ปรึกษาโครงการ</b> &nbsp;&nbsp; 1. ${esc(cfg.advisor)}</div>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-top:10px;">
          <tr><td style="width:40%;"></td><td style="width:60%; text-align:center;">ลงชื่อ..................................................ผู้เสนอ/ประธานโครงการ<br>(${esc(leader.student_name)})</td></tr>
        </table>
        <div style="font-size:13.5pt; margin-top:4px;"><b>หมายเหตุ</b> ผู้เสนอ/ประธานโครงการ คัดเลือกจากนักศึกษาที่เข้าร่วมโครงการ หากทำโครงการคนเดียว ก็ถือว่าเป็นผู้เสนอและประธาน ด้วย</div>
        <div style="margin-top:6px;"><b>ส่วนที่ 2 สำหรับสถานศึกษา</b> &nbsp; ความเห็นครูผู้รับผิดชอบกลุ่มนักศึกษาที่จัดทำกิจกรรม กพช.<div style="margin-left:1.5cm;">${esc(cfg.tOpinion)}</div></div>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-top:10px;">
          <tr><td style="width:36%;"></td><td style="width:64%; text-align:center;">ลงชื่อ..................................................ครูผู้รับผิดชอบกลุ่มนักศึกษาที่ทำกิจกรรม กพช.<br>(${esc(cfg.advisor)})</td></tr>
        </table>
      </div>
      ${wordPageBreak()}
      <div style="line-height:1.45; font-size:14.5pt;">
        <div><b>ความเห็นชอบของคณะกรรมการพิจารณาและประเมินผลการปฏิบัติโครงการ กพช.</b></div>
        <div style="margin-left:1.5cm; margin-top:4px;">
          &#9744; เห็นควรดำเนินการได้ โดยประมาณค่าหน่วยกิจกรรมโครงการนี้ จำนวน ......<b>${esc(cfg.hours)}</b>...... ชั่วโมง<br>
          &#9744; ควรปรับปรุงแก้ไข<br>
          1. ..............................................................................................................<br>
          2. ..............................................................................................................<br>
          3. ..............................................................................................................
        </div>
        <div style="text-align:center; margin-top:18px; line-height:1.55;">
          ลงชื่อ.................................................. ประธานคณะกรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการ<br>(${esc(cfg.comm1)})<br><br>
          ลงชื่อ.................................................. กรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการ<br>(${esc(cfg.comm2)})<br><br>
          ลงชื่อ.................................................. กรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการและเลขานุการ<br>(${esc(cfg.comm3)})
        </div>
        <table border="0" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; margin-top:24px;">
          <tr>
            <td style="width:50%; vertical-align:top; text-align:left;">
              <b>เสนอหัวหน้าสถานศึกษา</b><br>
              ........................................................................<br>
              ........................................................................<br><br>
              <div style="text-align:center;">ลงชื่อ..........................................นายทะเบียน<br>(${registrarName ? esc(registrarName) : '..........................................'})</div>
            </td>
            <td style="width:50%; vertical-align:top; text-align:left;">
              <b>ความเห็นของหัวหน้าสถานศึกษา</b><br>
              ........................................................................<br>
              ........................................................................<br><br>
              <div style="text-align:center;">ลงชื่อ..........................................<br>(${esc(cfg.director)})<br>ผู้อำนวยการ สกร.ระดับอำเภอคลองหลวง<br>วันที่............เดือน....................พ.ศ. .........</div>
            </td>
          </tr>
        </table>
      </div>`;

    return memo56Word + k3Word;
  }

  const rowsHtml = items.map((s, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td>${esc(s.student_name)}</td><td style="text-align:center;">${esc(s.student_id)}</td><td style="text-align:center;">${esc(s.role_note || (idx === 0 && isGroup ? 'ประธาน' : ''))}</td><td style="text-align:center;">${esc(s.level || '')}</td></tr>`).join('');

  const memo56Html = `
    <div class="memo-page">
      <div class="memo-header"><img src="${esc(garudaSrc)}" class="memo-garuda" onerror="this.style.display='none'"><div class="memo-title">บันทึกข้อความ</div></div>
      <div class="memo-field"><b>ส่วนราชการ</b> &nbsp; ${SCHOOL_NAME} &nbsp; <b>โทร.</b> 02 524 0645</div>
      <div class="memo-field" style="display:flex; justify-content:space-between;"><span><b>ที่</b> &nbsp; ${esc(cfg.docNo)}</span><span><b>วันที่</b> &nbsp; ${esc(cfg.docDate)} &nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="memo-field"><b>เรื่อง</b> &nbsp; ขออนุมัติโครงการกิจกรรมพัฒนาคุณภาพชีวิต</div>
      <div class="memo-divider"></div>
      <div class="memo-field" style="margin-bottom:10px;"><b>เรียน</b> &nbsp; ผู้อำนวยการ${SCHOOL_NAME}</div>
      <div class="memo-indent">ด้วยนักศึกษา ${SCHOOL_NAME} ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย จำนวน ${items.length} คน ได้เสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต โครงการ/กิจกรรม ${esc(cfg.projName)} ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate} สถานที่ปฏิบัติกิจกรรม ณ ${esc(cfg.loc)}</div>
      <div class="memo-indent">ในการนี้ ข้าพเจ้า ได้ดำเนินการตรวจสอบแบบเสนอโครงการแล้ว ปรากฏว่ามีความครบถ้วน ถูกต้อง และเหมาะสมที่จะปฏิบัติได้</div>
      <div class="memo-indent">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</div>
      <div class="sig-center" style="margin-left:38%; margin-top:24px;">ลงชื่อ..................................................<br>(${esc(cfg.advisor)})<br>ตำแหน่ง &nbsp;&nbsp; ${esc(cfg.advisorPos)}</div>
      <div style="margin-left:32%; margin-top:24px; line-height:1.6;">&#9744; อนุมัติ<br>&#9744; มอบคณะกรรมการตรวจสอบและประเมินค่าหน่วยกิจกรรม</div>
      <div class="sig-center" style="margin-left:38%; margin-top:34px;">(${esc(cfg.director)})<br>ผู้อำนวยการ${SCHOOL_NAME}</div>
    </div>`;

  const k3Html = `
  <div style="line-height:1.28; font-size:14.5pt;">
    <div class="kpch-box-tag">กพช. 3</div>
    <div class="doc-title-center" style="font-size:17pt !important;">แบบเสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต (สำหรับผู้เรียน)</div>
    <div style="margin-top:4px;"><b>ส่วนที่ 1 สำหรับผู้เรียน</b> &nbsp;|&nbsp; เสนอต่อสถานศึกษา <b>${SCHOOL_NAME}</b></div>
    <div><b>1. ชื่อโครงการ</b> &nbsp; ${esc(cfg.projName)}</div>
    <div><b>2. หลักการและเหตุผล</b><div class="doc-section-indent">${esc(cfg.rationale).replace(/\n/g, '<br>')}</div></div>
    <div><b>3. วัตถุประสงค์</b><div class="doc-section-indent">${esc(cfg.objectives).replace(/\n/g, '<br>')}</div></div>
    <div><b>4. เป้าหมาย</b><div class="doc-section-indent">${esc(cfg.target).replace(/\n/g, '<br>')}</div></div>
    <div><b>5. ขั้นตอน/แผนการปฏิบัติโครงการ</b><div class="doc-section-indent">${esc(cfg.steps).replace(/\n/g, '<br>')}</div></div>
    <div><b>6. สถานที่ดำเนินการ</b> &nbsp; ${esc(cfg.loc)}</div>
    <div><b>7. ระยะเวลาการดำเนินโครงการ</b> &nbsp; ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate}</div>
    <div><b>8. ปัจจัยในการดำเนินโครงการ</b> &nbsp; 8.1 เงิน ${esc(cfg.budget)} &nbsp; 8.2 วัสดุ ${esc(cfg.material)} &nbsp; 8.3 แรงงาน ${esc(cfg.labor)}</div>
    <div style="margin-bottom:4px;"><b>9. ผลที่คาดว่าจะได้รับ</b><div class="doc-section-indent">${esc(cfg.expected).replace(/\n/g, '<br>')}</div></div>
    <div><b>10. ผู้รับผิดชอบโครงการ</b> ชื่อ ${isGroup ? '........................................' : esc(leader.student_name)} รหัส ${isGroup ? '........................' : esc(leader.student_id)} (กรณีเสนอเป็นรายบุคคล)</div>
    <div><b>11. ผู้รับผิดชอบโครงการ</b> จำนวน ${isGroup ? items.length : '............'} คน ได้แก่ ${isGroup ? esc(leader.student_name) + ' และคณะ' : '........................................'} (กรณีเสนอเป็นกลุ่ม)</div>
    <div style="text-align:center; font-weight:bold; margin-top:4px;">รายชื่อผู้เข้าร่วมทำ${esc(cfg.projName)}</div>
    <table class="doc-table" style="font-size:14pt !important;"><thead><tr><th style="width:40px;">ที่</th><th>ชื่อ - สกุล</th><th style="width:125px;">รหัสนักศึกษา</th><th style="width:105px;">หมายเหตุ</th><th style="width:105px;">ระดับ</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <div style="margin-top:6px;"><b>12. ที่ปรึกษาโครงการ</b> &nbsp;&nbsp; 1. ${esc(cfg.advisor)}</div>
    <div class="sig-center" style="margin-left:38%; margin-top:10px;">ลงชื่อ..................................................ผู้เสนอ/ประธานโครงการ<br>(${esc(leader.student_name)})</div>
    <div style="font-size:13.5pt !important; margin-top:4px;"><b>หมายเหตุ</b> ผู้เสนอ/ประธานโครงการ คัดเลือกจากนักศึกษาที่เข้าร่วมโครงการ หากทำโครงการคนเดียว ก็ถือว่าเป็นผู้เสนอและประธาน ด้วย</div>
    <div style="margin-top:6px;"><b>ส่วนที่ 2 สำหรับสถานศึกษา</b> &nbsp; ความเห็นครูผู้รับผิดชอบกลุ่มนักศึกษาที่จัดทำกิจกรรม กพช.<div class="doc-section-indent">${esc(cfg.tOpinion)}</div></div>
    <div class="sig-center" style="margin-left:35%; margin-top:10px;">ลงชื่อ..................................................ครูผู้รับผิดชอบกลุ่มนักศึกษาที่ทำกิจกรรม กพช.<br>(${esc(cfg.advisor)})</div>

    <div class="page-break-before" style="page-break-inside:avoid;">
      <div><b>ความเห็นชอบของคณะกรรมการพิจารณาและประเมินผลการปฏิบัติโครงการ กพช.</b></div>
      <div style="margin-left:1.5cm; margin-top:4px;">&#9744; เห็นควรดำเนินการได้ โดยประมาณค่าหน่วยกิจกรรมโครงการนี้ จำนวน ......<b>${esc(cfg.hours)}</b>...... ชั่วโมง<br>&#9744; ควรปรับปรุงแก้ไข<br>1. ..............................................................................................................<br>2. ..............................................................................................................<br>3. ..............................................................................................................</div>
      <div class="sig-center" style="margin-top:16px;">
        ลงชื่อ.................................................. ประธานคณะกรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการ<br>(${esc(cfg.comm1)})<br><br>
        ลงชื่อ.................................................. กรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการ<br>(${esc(cfg.comm2)})<br><br>
        ลงชื่อ.................................................. กรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการและเลขานุการ<br>(${esc(cfg.comm3)})
      </div>
      <div class="sig-row-2" style="margin-top:24px;">
        <div class="sig-col" style="text-align:left;"><b>เสนอหัวหน้าสถานศึกษา</b><br>........................................................................<br>........................................................................<br><br><div style="text-align:center;">ลงชื่อ..........................................นายทะเบียน<br>(${registrarName ? esc(registrarName) : '..........................................'})</div></div>
        <div class="sig-col" style="text-align:left;"><b>ความเห็นของหัวหน้าสถานศึกษา</b><br>........................................................................<br>........................................................................<br><br><div style="text-align:center;">ลงชื่อ..........................................<br>(${esc(cfg.director)})<br>ผู้อำนวยการ สกร.ระดับอำเภอคลองหลวง<br>วันที่............เดือน....................พ.ศ. .........</div></div>
      </div>
    </div>
  </div>`;

  return memo56Html + k3Html;
}

async function executeOutputDoc56(mode = 'print') {
  const items = _doc56Items;
  if (!items || items.length === 0) return;
  const cfg = {
    docNo: document.getElementById('d56_doc_no').value.trim() || 'ศธ 07058.02/........',
    docDate: document.getElementById('d56_doc_date').value.trim() || '........................',
    advisorPos: document.getElementById('d56_advisor_pos').value.trim() || 'ครูประจำกลุ่ม',
    projName: document.getElementById('d56_project_name').value.trim(),
    hours: document.getElementById('d56_hours').value || '25',
    rationale: document.getElementById('d56_rationale').value,
    objectives: document.getElementById('d56_objectives').value,
    target: document.getElementById('d56_target').value,
    steps: document.getElementById('d56_steps').value,
    loc: document.getElementById('d56_location').value,
    sDate: formatThaiDateWithLabel(document.getElementById('d56_start_date').value),
    eDate: formatThaiDateWithLabel(document.getElementById('d56_end_date').value),
    budget: document.getElementById('d56_budget').value,
    material: document.getElementById('d56_material').value,
    labor: document.getElementById('d56_labor').value,
    expected: document.getElementById('d56_expected').value,
    advisor: document.getElementById('d56_advisor').value,
    tOpinion: document.getElementById('d56_teacher_opinion').value,
    comm1: document.getElementById('d56_comm1').value,
    comm2: document.getElementById('d56_comm2').value,
    comm3: document.getElementById('d56_comm3').value,
    director: document.getElementById('d56_director').value
  };

  closeModalById('doc56Modal');
  markPrintedClient('3', items.map(x => x.req12_id));

  if (mode === 'word') {
    showLoading('กำลังจัดเตรียมไฟล์ Word กพช. 3 + บันทึกข้อความ...');
    const garudaSrc = await getGarudaForWord();
    hideLoading();
    const first = items[0];
    const wordHtml = buildDoc56Html(items, cfg, true, garudaSrc);
    exportHtmlToWord(`กพช3_บันทึกข้อความ_${first.student_id || 'group'}`, wordHtml);
  } else {
    document.getElementById('printOnlyContainer').innerHTML = buildDoc56Html(items, cfg, false, GARUDA_URL);
    triggerPrint();
  }
}

function executePrintDoc56() {
  return executeOutputDoc56('print');
}

// ==================== แบบประเมิน กพช. 5 & กพช. 4 ====================
function buildKPCH5Html(item, isLastInPrint, imagesBase64 = [], directorNameOverride = '', forWord = false) {
  const startTxt = item.activity_date ? formatShortThaiDate(item.activity_date) : '', endTxt = item.activity_end_date ? formatShortThaiDate(item.activity_end_date) : '';
  const dirDisplay = esc(directorNameOverride || DIRECTOR_NAME);

  if (forWord) {
    const phaseWord = (label) => `
      <div style="margin-top:4px; line-height:1.45;">
        ${label} &nbsp; เมื่อวันที่ ${wordLineFill('', '..........')} เดือน ${wordLineFill('', '....................')} พ.ศ. ${wordLineFill('', '............')}
      </div>
      <div style="padding-left:22px; margin-bottom:2px;">&#9744; ผ่าน &nbsp;&nbsp;&nbsp;&nbsp; &#9744; ปรับปรุง</div>
      <div style="padding-left:22px; margin-bottom:5px;">เหตุผลประกอบการประเมิน &nbsp; ${wordLineFill('', '..............................................................................')}</div>`;

    let photoPageWord = '';
    if (imagesBase64.length > 0) {
      const rows = [];
      for (let i = 0; i < imagesBase64.length; i += 2) {
        const c1 = `<td style="width:50%; text-align:center; padding:8px; vertical-align:top;"><img src="${imagesBase64[i]}" width="250" style="width:250px; max-width:100%; height:auto; border:1px solid #cbd5e1;" /></td>`;
        const c2 = imagesBase64[i + 1]
          ? `<td style="width:50%; text-align:center; padding:8px; vertical-align:top;"><img src="${imagesBase64[i + 1]}" width="250" style="width:250px; max-width:100%; height:auto; border:1px solid #cbd5e1;" /></td>`
          : `<td style="width:50%;"></td>`;
        rows.push(`<tr>${c1}${c2}</tr>`);
      }
      photoPageWord = `
        ${wordPageBreak()}
        <div>
          <div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:6px;">ภาพถ่ายประกอบการดำเนินกิจกรรม (${esc(item.student_name)})</div>
          <div style="text-align:center; font-size:14pt; margin-bottom:10px;">โครงการ: ${esc(item.activity_name)} | รหัสอ้างอิง: ${esc(item.req_id)}</div>
          <table border="0" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse;">
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>`;
    }

    return `
      <div style="font-size:14.5pt; line-height:1.38;">
        <div style="text-align:right; font-size:14.5pt; font-weight:bold; margin-bottom:2px;">กพช. 5</div>
        <div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:8px;">แบบประเมินผลการปฏิบัติโครงการกิจกรรมพัฒนาคุณภาพชีวิต</div>
        <div>ชื่อโครงการที่ประเมิน &nbsp; ${wordLineFill(item.activity_name, '........................................................................')}</div>
        <div>ชื่อประธานโครงการ &nbsp; ${wordLineFill(item.student_name, '............................................................................')}</div>
        <div>ระยะเวลาที่เริ่มปฏิบัติตามโครงการ &nbsp; ${wordLineFill(startTxt, '............................')} &nbsp; วันสิ้นสุดโครงการ &nbsp; ${wordLineFill(endTxt, '............................')}</div>
        <div style="margin-bottom:8px;">สถานที่ปฏิบัติโครงการ &nbsp; ${wordLineFill(item.location || '', '........................................................................')}</div>
        <div style="font-weight:bold; margin-bottom:4px;">บันทึกความก้าวหน้าโครงการ</div>
        ${phaseWord('ระยะที่ 1 ก่อนดำเนินโครงการ')}
        ${phaseWord('ระยะที่ 2 ระหว่างดำเนินโครงการ')}
        ${phaseWord('ระยะที่ 3 เสร็จสิ้นโครงการ')}
        <div style="font-weight:bold; margin-top:8px; margin-bottom:6px;">สรุปรายละเอียดการประเมินผลโครงการ</div>
        <table border="1" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse; font-size:13.5pt;">
          <thead>
            <tr>
              <th rowspan="2" style="border:1px solid #000; width:7%; text-align:center; padding:4px;">ที่</th>
              <th rowspan="2" style="border:1px solid #000; width:51%; text-align:center; padding:4px;">รายการ</th>
              <th colspan="2" style="border:1px solid #000; width:22%; text-align:center; padding:4px;">คะแนน</th>
              <th rowspan="2" style="border:1px solid #000; width:20%; text-align:center; padding:4px;">หมายเหตุ</th>
            </tr>
            <tr>
              <th style="border:1px solid #000; text-align:center; padding:4px;">เต็ม</th>
              <th style="border:1px solid #000; text-align:center; padding:4px;">ได้</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">1</td><td style="border:1px solid #000; padding:3px 6px;">ประโยชน์ที่ผู้เรียน/ครอบครัว/ชุมชนได้รับ</td><td style="border:1px solid #000; text-align:center;">20</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">2</td><td style="border:1px solid #000; padding:3px 6px;">การใช้กระบวนการกลุ่ม</td><td style="border:1px solid #000; text-align:center;">20</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">3</td><td style="border:1px solid #000; padding:3px 6px;">ความยากง่ายในการดำเนินงาน</td><td style="border:1px solid #000; text-align:center;">20</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">4</td><td style="border:1px solid #000; padding:3px 6px;">การมีส่วนร่วมของตนเอง/ครอบครัว/ชุมชน</td><td style="border:1px solid #000; text-align:center;">10</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">5</td><td style="border:1px solid #000; padding:3px 6px;">ความเหมาะสมในการใช้เวลาปฏิบัติงาน</td><td style="border:1px solid #000; text-align:center;">10</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">6</td><td style="border:1px solid #000; padding:3px 6px;">ปัจจัยที่เอื้อต่อความสำเร็จ</td><td style="border:1px solid #000; text-align:center;">10</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; padding:3px 5px;">7</td><td style="border:1px solid #000; padding:3px 6px;">ความคิดริเริ่มสร้างสรรค์</td><td style="border:1px solid #000; text-align:center;">10</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td colspan="2" style="border:1px solid #000; text-align:center; font-weight:bold; padding:3px 5px;">รวม</td><td style="border:1px solid #000; text-align:center; font-weight:bold;">100</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
          </tbody>
        </table>
      </div>
      ${wordPageBreak()}
      <div style="font-size:15pt; line-height:1.5;">
        <div style="text-align:center; margin-bottom:10px;">- 2 -</div>
        <div style="font-weight:bold; margin-bottom:8px;">ความเห็นของคณะกรรมการ</div>
        <div style="margin-bottom:8px;">................................................................................................................................................</div>
        <div style="margin-bottom:8px;">................................................................................................................................................</div>
        <div style="margin-bottom:22px;">................................................................................................................................................</div>
        <div style="text-align:center; margin-bottom:22px;">ประเมินผลเมื่อวันที่................เดือน..........................พ.ศ. ................</div>
        <div style="margin-left:18%; margin-bottom:18px;">ลงชื่อ........................................................ ประธานคณะกรรมการ<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(${COMM_1_NAME})</div>
        <div style="margin-left:18%; margin-bottom:18px;">ลงชื่อ........................................................ คณะกรรมการ<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(${COMM_2_NAME})</div>
        <div style="margin-left:18%; margin-bottom:24px;">ลงชื่อ........................................................ คณะกรรมการและเลขานุการ<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(${COMM_3_NAME})</div>
        <div style="font-weight:bold; margin-bottom:4px;">ผลการพิจารณาอนุมัติของผู้บริหารสถานศึกษา</div>
        <div style="margin-bottom:8px;">- อนุมัติ จำนวน..........................ชั่วโมง.</div>
        <div style="margin-bottom:8px;">................................................................................................................................................</div>
        <div style="margin-bottom:24px;">................................................................................................................................................</div>
        <div style="text-align:center; line-height:1.5;">
          ลงชื่อ........................................................ ผู้อนุมัติ<br>
          (${dirDisplay})<br>
          ผู้อำนวยการ สกร.ระดับอำเภอคลองหลวง<br>
          อนุมัติผลเมื่อวันที่................เดือน..........................พ.ศ. ................
        </div>
      </div>
      ${photoPageWord}
      ${!isLastInPrint ? wordPageBreak() : ''}`;
  }

  const dotsStr = '.'.repeat(140), dotSpan = `<span style="flex:1; min-width:12px; overflow:hidden; white-space:nowrap; letter-spacing:1px;">${dotsStr}</span>`;
  const makeDotFlex = (val, extraStyle = '') => { const clean = esc(val); return !clean ? `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>` : `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`; };
  const makeDotInline = (val, extraStyle = '') => { const clean = esc(val); return !clean ? `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>` : `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`; };
  const chkBox = '<span style="display:inline-block; width:13px; height:13px; border:1px solid #000; vertical-align:-2px; margin-right:5px;"></span>', row5 = 'display:flex; align-items:center; gap:8px; margin-bottom:4px; line-height:1.3;';
  const phaseRow = (label) => `<div style="${row5} margin-top:4px;"><span style="white-space:nowrap;">${label}</span><span>เมื่อวันที่</span>${makeDotInline('', 'width:50px;')}<span>เดือน</span>${makeDotInline('', 'width:95px;')}<span>พ.ศ.</span>${makeDotFlex('', 'min-width:50px;')}</div><div style="padding-left:22px; margin-bottom:4px;">${chkBox}ผ่าน &nbsp;&nbsp;&nbsp;&nbsp; ${chkBox}ปรับปรุง</div><div style="${row5} padding-left:22px; margin-bottom:6px;"><span>เหตุผลประกอบการประเมิน</span>${makeDotFlex('')}</div>`;
  const photoPage = imagesBase64.length > 0 ? `<div class="${isLastInPrint ? '' : 'memo-page'}"><div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:8px;">ภาพถ่ายประกอบการดำเนินกิจกรรม (${esc(item.student_name)})</div><div style="text-align:center; font-size:14pt; margin-bottom:10px;">โครงการ: ${esc(item.activity_name)} | รหัสอ้างอิง: ${esc(item.req_id)}</div><div class="photo-grid">${imagesBase64.map(b => `<img src="${b}">`).join('')}</div></div>` : '';

  return `
    <div class="memo-page" style="font-size:14.5pt; line-height:1.35;">
      <div style="text-align:right; font-size:14.5pt; margin-bottom:2px;">กพช. 5</div>
      <div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:10px;">แบบประเมินผลการปฏิบัติโครงการกิจกรรมพัฒนาคุณภาพชีวิต</div>
      <div style="${row5}"><span>ชื่อโครงการที่ประเมิน</span>${makeDotFlex(item.activity_name)}</div>
      <div style="${row5}"><span>ชื่อประธานโครงการ</span>${makeDotFlex(item.student_name)}</div>
      <div style="${row5}"><span>ระยะเวลาที่เริ่มปฏิบัติตามโครงการ</span>${makeDotFlex(startTxt)}<span>วันสิ้นสุดโครงการ</span>${makeDotFlex(endTxt)}</div>
      <div style="${row5} margin-bottom:10px;"><span>สถานที่ปฏิบัติโครงการ</span>${makeDotFlex(item.location || '')}</div>
      <div style="font-weight:bold; margin-bottom:4px;">บันทึกความก้าวหน้าโครงการ</div>
      ${phaseRow('ระยะที่ 1 ก่อนดำเนินโครงการ')}${phaseRow('ระยะที่ 2 ระหว่างดำเนินโครงการ')}${phaseRow('ระยะที่ 3 เสร็จสิ้นโครงการ')}
      <div style="font-weight:bold; margin-top:10px; margin-bottom:6px;">สรุปรายละเอียดการประเมินผลโครงการ</div>
      <table class="batch-table" style="font-size:13.5pt !important; margin-top:0;">
        <thead><tr><th rowspan="2" style="width:6%;">ที่</th><th rowspan="2" style="width:52%;">รายการ</th><th colspan="2" style="width:22%;">คะแนน</th><th rowspan="2" style="width:20%;">หมายเหตุ</th></tr><tr><th>เต็ม</th><th>ได้</th></tr></thead>
        <tbody>
          <tr><td style="text-align:center;">1</td><td>ประโยชน์ที่ผู้เรียน/ครอบครัว/ชุมชนได้รับ</td><td style="text-align:center;">20</td><td></td><td></td></tr>
          <tr><td style="text-align:center;">2</td><td>การใช้กระบวนการกลุ่ม</td><td style="text-align:center;">20</td><td></td><td></td></tr>
          <tr><td style="text-align:center;">3</td><td>ความยากง่ายในการดำเนินงาน</td><td style="text-align:center;">20</td><td></td><td></td></tr>
          <tr><td style="text-align:center;">4</td><td>การมีส่วนร่วมของตนเอง/ครอบครัว/ชุมชน</td><td style="text-align:center;">10</td><td></td><td></td></tr>
          <tr><td style="text-align:center;">5</td><td>ความเหมาะสมในการใช้เวลาปฏิบัติงาน</td><td style="text-align:center;">10</td><td></td><td></td></tr>
          <tr><td style="text-align:center;">6</td><td>ปัจจัยที่เอื้อต่อความสำเร็จ</td><td style="text-align:center;">10</td><td></td><td></td></tr>
          <tr><td style="text-align:center;">7</td><td>ความคิดริเริ่มสร้างสรรค์</td><td style="text-align:center;">10</td><td></td><td></td></tr>
          <tr><td colspan="2" style="text-align:center; font-weight:bold;">รวม</td><td style="text-align:center;">100</td><td></td><td></td></tr>
        </tbody>
      </table>
    </div>
    <div class="${(isLastInPrint && !photoPage) ? '' : 'memo-page'}" style="font-size:15pt; line-height:1.5;">
      <div style="text-align:center; margin-bottom:10px;">- 2 -</div>
      <div style="font-weight:bold; margin-bottom:8px;">ความเห็นของคณะกรรมการ</div>
      <div style="display:flex; margin-bottom:10px;">${makeDotFlex('')}</div><div style="display:flex; margin-bottom:10px;">${makeDotFlex('')}</div><div style="display:flex; margin-bottom:26px;">${makeDotFlex('')}</div>
      <div style="display:flex; justify-content:center; gap:6px; margin-bottom:24px;"><span>ประเมินผลเมื่อวันที่</span>${makeDotInline('', 'width:65px;')}<span>เดือน</span>${makeDotInline('', 'width:110px;')}<span>พ.ศ.</span>${makeDotInline('', 'width:70px;')}</div>
      <div style="margin-left:20%; margin-bottom:20px;"><div style="display:flex;"><span>ลงชื่อ</span><div style="text-align:center; margin:0 6px;">${makeDotInline('', 'width:190px;')}<br>(${COMM_1_NAME})</div><span>ประธานคณะกรรมการ</span></div></div>
      <div style="margin-left:20%; margin-bottom:20px;"><div style="display:flex;"><span>ลงชื่อ</span><div style="text-align:center; margin:0 6px;">${makeDotInline('', 'width:190px;')}<br>(${COMM_2_NAME})</div><span>คณะกรรมการ</span></div></div>
      <div style="margin-left:20%; margin-bottom:28px;"><div style="display:flex;"><span>ลงชื่อ</span><div style="text-align:center; margin:0 6px;">${makeDotInline('', 'width:190px;')}<br>(${COMM_3_NAME})</div><span>คณะกรรมการและเลขานุการ</span></div></div>
      <div style="font-weight:bold; margin-bottom:4px;">ผลการพิจารณาอนุมัติของผู้บริหารสถานศึกษา</div>
      <div style="display:flex; gap:6px; margin-bottom:10px;"><span>- อนุมัติ จำนวน</span>${makeDotInline('', 'width:100px;')}<span>ชั่วโมง.</span></div>
      <div style="display:flex; margin-bottom:10px;">${makeDotFlex('')}</div><div style="display:flex; margin-bottom:28px;">${makeDotFlex('')}</div>
      <div style="text-align:center;">ลงชื่อ${makeDotInline('', 'width:190px; margin:0 6px;')}ผู้อนุมัติ<br>(${dirDisplay})<br>ผู้อำนวยการ สกร.ระดับอำเภอคลองหลวง<br>อนุมัติผลเมื่อวันที่${makeDotInline('', 'width:65px;')}เดือน${makeDotInline('', 'width:110px;')}พ.ศ.${makeDotInline('', 'width:70px;')}</div>
    </div>
    ${photoPage}`;
}

function buildKPCH4Html(items, cfg, forWord = false) {
  const first = items[0], isGroup = items.length > 1;
  const termText = getItemTerm(first) || '-';

  if (forWord) {
    const groupTableWord = isGroup ? `
      <div style="margin-top:6px; font-weight:bold;">รายชื่อผู้ปฏิบัติโครงการ (กรณีรายกลุ่ม)</div>
      <table border="1" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse; margin-top:4px; font-size:14pt;">
        <thead>
          <tr>
            <th style="border:1px solid #000; width:40px; text-align:center; padding:4px;">ที่</th>
            <th style="border:1px solid #000; text-align:center; padding:4px;">ชื่อ - สกุล</th>
            <th style="border:1px solid #000; width:125px; text-align:center; padding:4px;">รหัสประจำตัว</th>
            <th style="border:1px solid #000; width:90px; text-align:center; padding:4px;">ระดับ</th>
            <th style="border:1px solid #000; width:125px; text-align:center; padding:4px;">ลายมือชื่อ</th>
          </tr>
        </thead>
        <tbody>${items.map((x, i) => `
          <tr>
            <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${i + 1}</td>
            <td style="border:1px solid #000; padding:3px 6px;">${esc(x.student_name)}</td>
            <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${esc(x.student_id)}</td>
            <td style="border:1px solid #000; text-align:center; padding:3px 5px;">${esc(x.level || '')}</td>
            <td style="border:1px solid #000; padding:3px 5px;"></td>
          </tr>`).join('')}
        </tbody>
      </table>` : '';

    return `
      <div style="font-size:15pt; line-height:1.45;">
        ${wordBoxTagHtml('กพช. 4')}
        <div style="text-align:center; font-weight:bold; font-size:17pt; line-height:1.25; margin-bottom:10px;">แบบรายงานผลสำเร็จของโครงการกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับผู้เรียน)</div>
        <div style="margin-top:8px;"><b>1. ชื่อโครงการที่ปฏิบัติ</b> &nbsp; ${esc(cfg.projName)}</div>
        <div><b>2. ระยะเวลาที่ปฏิบัติโครงการ</b> ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate}<br>&nbsp;&nbsp;&nbsp;&nbsp;สถานที่ปฏิบัติกิจกรรม &nbsp; ${esc(cfg.loc)}</div>
        <div><b>3. ผู้ปฏิบัติโครงการ</b>
          <div style="margin-left:1.5cm;">
            3.1 กรณีรายบุคคล &nbsp; ชื่อ-สกุล ${isGroup ? '............................' : esc(first.student_name)} &nbsp; รหัสประจำตัว ${isGroup ? '....................' : esc(first.student_id)}<br>
            ระดับ ${isGroup ? '................' : esc(first.level || '')} &nbsp; กศน.ตำบล/กลุ่ม ${esc(first.group_name || '-')} &nbsp; ภาคเรียนที่ ${esc(termText)}<br>
            3.2 กรณีรายกลุ่ม ให้แนบรายชื่อ-สกุล พร้อมลายมือชื่อ รหัสประจำตัว
          </div>
        </div>
        ${groupTableWord}
        <div><b>4. ผลการปฏิบัติโครงการ ประกอบด้วย</b>
          <div style="margin-left:1.5cm;">
            <b>4.1 การคิด/การวางแผน</b><br>${esc(first.k4_plan || '-').replace(/\n/g, '<br>')}<br>
            <b>4.2 การดำเนินงาน/ขั้นตอนการดำเนินงาน</b><br>${esc(first.activity_detail || '-').replace(/\n/g, '<br>')}<br>
            <b>4.3 การเรียนรู้และประสบการณ์ที่ได้รับ</b><br>${esc(first.k4_learning || '-').replace(/\n/g, '<br>')}<br>
            <b>4.4 ปัญหาที่พบและการแก้ไข</b><br>${esc(first.k4_problem || 'ไม่พบปัญหาในการทำงาน').replace(/\n/g, '<br>')}
          </div>
        </div>
        <div><b>5. การนำไปใช้ในการพัฒนาคุณภาพชีวิต</b><div style="margin-left:1.5cm;">${esc(first.k4_apply || '-').replace(/\n/g, '<br>')}</div></div>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-top:16px;">
          <tr><td style="width:40%;"></td><td style="width:60%; text-align:center;">ลงชื่อ..................................................ผู้ดำเนินงาน/ประธานโครงการ<br>(${esc(first.student_name)})</td></tr>
        </table>
        <div style="margin-top:18px;">
          <div><b>ขอรับรองว่า ได้ให้คำแนะนำ และให้คำปรึกษาตลอดระยะเวลาการดำเนินโครงการจริง</b></div>
          <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-top:14px;">
            <tr>
              <td style="width:36%;"></td>
              <td style="width:64%; text-align:center; line-height:1.5;">
                ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(${esc(cfg.tName)})<br><br>
                ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(..................................................)<br><br>
                ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(..................................................)
              </td>
            </tr>
          </table>
        </div>
      </div>`;
  }

  const groupTable = isGroup ? `<div style="margin-top:6px; font-weight:bold;">รายชื่อผู้ปฏิบัติโครงการ (กรณีรายกลุ่ม)</div><table class="doc-table"><thead><tr><th style="width:40px;">ที่</th><th>ชื่อ - สกุล</th><th style="width:125px;">รหัสประจำตัว</th><th style="width:90px;">ระดับ</th><th style="width:125px;">ลายมือชื่อ</th></tr></thead><tbody>${items.map((x, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${esc(x.student_name)}</td><td style="text-align:center;">${esc(x.student_id)}</td><td style="text-align:center;">${esc(x.level || '')}</td><td></td></tr>`).join('')}</tbody></table>` : '';

  return `
    <div class="memo-page">
      <div class="kpch-box-tag">กพช. 4</div>
      <div class="doc-title-center">แบบรายงานผลสำเร็จของโครงการกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับผู้เรียน)</div>
      <div style="margin-top:8px;"><b>1. ชื่อโครงการที่ปฏิบัติ</b> &nbsp; ${esc(cfg.projName)}</div>
      <div><b>2. ระยะเวลาที่ปฏิบัติโครงการ</b> ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate}<br>&nbsp;&nbsp;&nbsp;&nbsp;สถานที่ปฏิบัติกิจกรรม &nbsp; ${esc(cfg.loc)}</div>
      <div><b>3. ผู้ปฏิบัติโครงการ</b>
        <div class="doc-section-indent">
          3.1 กรณีรายบุคคล &nbsp; ชื่อ-สกุล ${isGroup ? '............................' : esc(first.student_name)} &nbsp; รหัสประจำตัว ${isGroup ? '....................' : esc(first.student_id)}<br>
          ระดับ ${isGroup ? '................' : esc(first.level || '')} &nbsp; กศน.ตำบล/กลุ่ม ${esc(first.group_name || '-')} &nbsp; ภาคเรียนที่ ${esc(termText)}<br>
          3.2 กรณีรายกลุ่ม ให้แนบรายชื่อ-สกุล พร้อมลายมือชื่อ รหัสประจำตัว
        </div>
      </div>
      ${groupTable}
      <div><b>4. ผลการปฏิบัติโครงการ ประกอบด้วย</b>
        <div class="doc-section-indent">
          <b>4.1 การคิด/การวางแผน</b><br>${esc(first.k4_plan || '-').replace(/\n/g, '<br>')}<br>
          <b>4.2 การดำเนินงาน/ขั้นตอนการดำเนินงาน</b><br>${esc(first.activity_detail || '-').replace(/\n/g, '<br>')}<br>
          <b>4.3 การเรียนรู้และประสบการณ์ที่ได้รับ</b><br>${esc(first.k4_learning || '-').replace(/\n/g, '<br>')}<br>
          <b>4.4 ปัญหาที่พบและการแก้ไข</b><br>${esc(first.k4_problem || 'ไม่พบปัญหาในการทำงาน').replace(/\n/g, '<br>')}
        </div>
      </div>
      <div><b>5. การนำไปใช้ในการพัฒนาคุณภาพชีวิต</b><div class="doc-section-indent">${esc(first.k4_apply || '-').replace(/\n/g, '<br>')}</div></div>
      <div class="sig-center" style="margin-left:38%;">ลงชื่อ..................................................ผู้ดำเนินงาน/ประธานโครงการ<br>(${esc(first.student_name)})</div>
      <div style="page-break-inside:avoid; margin-top:18px;">
        <div><b>ขอรับรองว่า ได้ให้คำแนะนำ และให้คำปรึกษาตลอดระยะเวลาการดำเนินโครงการจริง</b></div>
        <div class="sig-center" style="margin-left:35%; margin-top:16px;">
          ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(${esc(cfg.tName)})<br><br>
          ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(..................................................)<br><br>
          ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(..................................................)
        </div>
      </div>
    </div>`;
}
// ==================== ตารางรายงานผล กพช. 4-6 ====================
function toggleAllChecks(master) {
  document.querySelectorAll('.reg-check').forEach(cb => cb.checked = master.checked);
}

function getFilteredDashItems() {
  const kw = (document.getElementById('dashSearchInput')?.value || '').toLowerCase().trim();
  const termVal = document.getElementById('dashTermFilter')?.value || 'ALL';
  const catVal = document.getElementById('dashCategoryFilter')?.value || 'ALL';
  const printVal = document.getElementById('dashPrintFilter')?.value || 'ALL';
  const teacherVal = document.getElementById('dashTeacherFilter')?.value || 'ALL';
  const showTeacherFilter = ['REGISTRAR', 'ADMIN'].includes(currentUser?.role);

  return dashItems.filter(item => {
    if (filterMode === 'PENDING' && !isMyPendingItem(item)) return false;
    if (!matchesTermFilter(getItemTerm(item), termVal)) return false;
    if (catVal !== 'ALL' && String(item.category || '').trim() !== catVal) return false;
    if (printVal === 'PRINTED' && !item.printed_46_at) return false;
    if (printVal === 'NOT_PRINTED' && !!item.printed_46_at) return false;
    if (showTeacherFilter && teacherVal !== 'ALL' && String(item.teacher_name || '').trim() !== teacherVal) return false;
    if (kw) {
      const text = `${item.req_id} ${item.ref_12_id || ''} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.category || ''} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });
}

function renderDashboardList() {
  const isAdmin = currentUser?.role === 'ADMIN';
  const canCheck = ['TEACHER', 'REGISTRAR', 'ADMIN'].includes(currentUser?.role);
  const filtered = getFilteredDashItems();
  currentFilteredSubs = filtered;
  const tbody = document.getElementById('dashTableBody'), mobileBox = document.getElementById('dashMobileCards'), masterCb = document.getElementById('checkAllBox');
  if (masterCb) masterCb.checked = false;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${canCheck ? 7 : 6}" class="text-center py-4 text-muted">ไม่มีรายการในหมวดหมู่นี้</td></tr>`;
    mobileBox.innerHTML = `<div class="text-center py-4 text-muted">ไม่มีรายการในหมวดหมู่นี้</div>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
    const canAct = item.current_step === 'WAIT_TEACHER' && ['TEACHER', 'ADMIN'].includes(currentUser?.role);
    const termTxt = getItemTerm(item);
    const printBadge = item.printed_46_at ? `<div class="mt-1"><span class="badge bg-success bg-opacity-15 text-success border border-success">✅ ปริ้น 4-6 แล้ว</span></div>` : `<div class="mt-1"><span class="badge bg-light text-muted border">⏳ ยังไม่ปริ้น 4-6</span></div>`;
    return `
      <tr>
        ${canCheck ? `<td><input type="checkbox" class="reg-check" value="${esc(item.req_id)}" onchange="syncCheckPair(this, 'reg-check')"></td>` : ''}
        <td><div class="fw-bold text-primary">${esc(item.req_id)}</div><div class="small text-muted">${esc(item.created_at)} ${termTxt ? `<span class="badge bg-light text-dark border ms-1">ภาค ${esc(termTxt)}</span>` : ''}</div></td>
        <td><div class="fw-semibold">${esc(item.student_name)}</div><div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div></td>
        <td class="small"><div>${esc(item.teacher_name)}</div>${item.category ? `<span class="badge bg-info bg-opacity-10 text-dark border">${esc(item.category)}</span>` : ''}</td>
        <td><div class="fw-semibold">${esc(item.activity_name)}</div><div class="small text-muted">${formatShortThaiDate(item.activity_date)} ถึง ${formatShortThaiDate(item.activity_end_date)} | <b>${esc(item.hours)} ชม.</b></div></td>
        <td><span class="badge step-badge ${st.cls}">${st.text}</span>${printBadge}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" onclick="openDetailModal('${escJs(item.req_id)}')"><i class="bi bi-eye"></i> ${canAct ? 'ตรวจ/อนุมัติ' : 'ดูข้อมูล'}</button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill ms-1" title="พิมพ์หรือดาวน์โหลด Word กพช.4-6" onclick="printSingle46('${escJs(item.req_id)}')"><i class="bi bi-printer"></i> กพช.4-6</button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="confirmDeleteSubmissions(['${escJs(item.req_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`;
  }).join('');

  mobileBox.innerHTML = filtered.map(item => {
    const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
    const canAct = item.current_step === 'WAIT_TEACHER' && ['TEACHER', 'ADMIN'].includes(currentUser?.role);
    const printBadge = item.printed_46_at ? `<span class="badge bg-success bg-opacity-15 text-success border border-success ms-1">✅ 4-6</span>` : '';
    return `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>${canCheck ? `<input type="checkbox" class="reg-check me-2" value="${esc(item.req_id)}" onchange="syncCheckPair(this, 'reg-check')">` : ''}<span class="fw-bold text-primary">${esc(item.req_id)}</span>${printBadge}</div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-2"><b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)}) | <b>ชั่วโมง:</b> ${esc(item.hours)} ชม.</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm rounded-pill flex-fill fw-bold" onclick="openDetailModal('${escJs(item.req_id)}')"><i class="bi bi-eye me-1"></i>${canAct ? 'ตรวจ / อนุมัติ' : 'ดูรายละเอียด'}</button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="printSingle46('${escJs(item.req_id)}')"><i class="bi bi-printer"></i> กพช.4-6</button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDeleteSubmissions(['${escJs(item.req_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function confirmBatchApproveSub() {
  const checkedIds = getCheckedUniqueIds('reg-check');
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && it.current_step === 'WAIT_TEACHER'; });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ "รอครูประจำกลุ่มอนุมัติ" อย่างน้อย 1 รายการ', 'warning');
  Swal.fire({ title: `อนุมัติและส่งตรงนายทะเบียน ${validIds.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยันอนุมัติส่งทะเบียน', confirmButtonColor: '#10b981' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังอนุมัติและส่งต่อนายทะเบียน...');
      try { const r = await callApi('batchApproveSubmissions', { token: authToken, req_ids: validIds }); hideLoading(); safeAlert('สำเร็จ 🎉', `อนุมัติและส่งต่อนายทะเบียนเรียบร้อยแล้ว ${r.count} รายการ`, 'success'); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchRejectSub() {
  const checkedIds = getCheckedUniqueIds('reg-check');
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && it.current_step === 'WAIT_TEACHER'; });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่รอครูตรวจอย่างน้อย 1 รายการ', 'warning');
  Swal.fire({
    title: `ตีกลับผลงาน (${validIds.length} รายการ)`, input: 'textarea', inputLabel: 'ระบุเหตุผลในการตีกลับให้นักศึกษาแก้ไข',
    inputPlaceholder: 'เช่น รูปภาพไม่ชัดเจน, ชั่วโมงไม่ถูกต้อง, เนื้อหา กพช.4 ไม่ครบ...', showCancelButton: true, confirmButtonText: 'ยืนยันตีกลับ', confirmButtonColor: '#ef4444',
    inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; }
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังบันทึกการตีกลับ...');
      try { const r = await callApi('batchRejectSubmissions', { token: authToken, req_ids: validIds, reason: res.value.trim() }); hideLoading(); safeAlert('ตีกลับเรียบร้อย', `ส่งคืนให้นักศึกษาแก้ไข ${r.count} รายการแล้ว`, 'success'); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchDeleteSub() {
  const ids = getCheckedUniqueIds('reg-check');
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการย้ายลงถังขยะ', 'warning');
  confirmDeleteSubmissions(ids);
}

function confirmDeleteSubmissions(reqIds) {
  if (!currentUser || currentUser.role !== 'ADMIN') return safeAlert('ไม่มีสิทธิ์', 'เฉพาะ Admin เท่านั้น', 'error');
  Swal.fire({ title: `ย้ายผลงาน (${reqIds.length} รายการ) ลงถังขยะ?`, icon: 'warning', showCancelButton: true, confirmButtonText: '🗑️ ย้ายลงถังขยะ', confirmButtonColor: '#dc2626' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังย้ายลงถังขยะ...');
      try { const r = await callApi('deleteSubmissions', { token: authToken, req_ids: reqIds }); hideLoading(); closeModalById('detailModal'); safeAlert('เรียบร้อย 🗑️', `ย้ายลงถังขยะแล้ว ${r.count} รายการ`, 'success'); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

// ==================== พิมพ์ / โหลด Word ชุด กพช. 4-6 + บันทึกข้อความ ====================
function printSingle46(reqId) {
  const item = dashItems.find(x => x.req_id === reqId);
  if (!item) return;
  openDoc57ModalWithItems([item]);
}

function openDoc57ConfigAndPrint() {
  const checkedIds = getCheckedUniqueIds('reg-check');
  if (checkedIds.length === 0) {
    return safeAlert('กรุณาติ๊กเลือกรายชื่อ', 'กรุณาติ๊กถูกหน้ารายชื่อนักศึกษาที่ต้องการออกเอกสาร กพช. 4-6 อย่างน้อย 1 คนก่อนครับ', 'warning');
  }
  openDoc57ModalWithItems(dashItems.filter(x => checkedIds.includes(x.req_id)));
}

function openDoc57ModalWithItems(items) {
  if (!items || !items[0]) return;
  _doc57TargetIds = items.map(x => x.req_id);
  const first = items[0];
  document.getElementById('d57_count').innerText = items.length;
  document.getElementById('d57_doc_no').value = 'ศธ 07058.02/';
  document.getElementById('d57_doc_date').value = formatThaiDate();
  document.getElementById('d57_project_name').value = first.activity_name || '';
  document.getElementById('d57_location').value = first.location || 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง จังหวัดปทุมธานี';
  document.getElementById('d57_pass_count').value = items.length;
  document.getElementById('d57_fail_count').value = 0;
  document.getElementById('d57_hours').value = first.hours || 25;
  document.getElementById('d57_teacher_name').value = first.teacher_name || (currentUser?.full_name || '');
  document.getElementById('d57_registrar').value = registrarName || '';
  document.getElementById('d57_director').value = DIRECTOR_NAME;
  openModalById('doc57Modal');
}

function buildDoc57Html(batchData, cfg, forWord = false, garudaSrc = GARUDA_URL) {
  const items = batchData.map(b => b.item), first = items[0];
  const uniqueImgs = Array.from(new Set(batchData.flatMap(b => b.imagesBase64 || [])));

  if (forWord) {
    const memoWord = `
      <div style="font-size:15.5pt; line-height:1.45;">
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td style="width:72px; vertical-align:bottom;"><img src="${esc(garudaSrc)}" width="58" style="width:58px; height:auto;" /></td>
            <td style="text-align:center; vertical-align:bottom; font-size:24pt; font-weight:bold;">บันทึกข้อความ</td>
            <td style="width:72px;"></td>
          </tr>
        </table>
        <div style="margin-bottom:3px;"><b>ส่วนราชการ</b> &nbsp; ${SCHOOL_NAME} &nbsp;&nbsp;&nbsp; <b>โทร.</b> 02 524 0645</div>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-bottom:3px;">
          <tr>
            <td style="width:55%;"><b>ที่</b> &nbsp; ${esc(cfg.docNo)}</td>
            <td style="width:45%;"><b>วันที่</b> &nbsp; ${esc(cfg.docDate)}</td>
          </tr>
        </table>
        <div style="margin-bottom:4px;"><b>เรื่อง</b> &nbsp; รายงานผลสำเร็จโครงการกิจกรรมพัฒนาคุณภาพชีวิตและขออนุมัติชั่วโมงกิจกรรม</div>
        <div style="border-bottom:1.5px solid #000; margin:6px 0 12px 0;">&nbsp;</div>
        <div style="margin-bottom:8px;"><b>เรียน</b> &nbsp; ผู้อำนวยการ${SCHOOL_NAME}</div>
        <p style="text-indent:2.5cm; margin:0 0 8px 0; text-align:justify;">ตามที่นักศึกษา ${SCHOOL_NAME} ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย จำนวน ${items.length} คน ได้เสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต โครงการ/กิจกรรม ${esc(cfg.projName)} ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate} สถานที่ปฏิบัติกิจกรรม ${esc(cfg.loc)} โดยได้รับอนุมัติชั่วโมงกิจกรรม จำนวน ${esc(cfg.hours)} ชั่วโมง นั้น</p>
        <p style="text-indent:2.5cm; margin:0 0 8px 0; text-align:justify;">ในการนี้ การปฏิบัติกิจกรรมตามโครงการได้เสร็จสิ้นเรียบร้อยแล้ว มีนักศึกษาเข้าร่วมโครงการและปฏิบัติกิจกรรมดังกล่าวโดยผ่านกิจกรรมจำนวน ${esc(cfg.passCount)} คน และไม่ผ่านกิจกรรมจำนวน ${esc(cfg.failCount)} คน และข้าพเจ้าได้ตรวจสอบเอกสารแล้ว มีความครบถ้วนถูกต้อง ทั้งนี้ได้แนบภาพถ่ายและใบลงชื่อมาด้วยแล้ว</p>
        <p style="text-indent:2.5cm; margin:0 0 14px 0;">จึงเรียนมาเพื่อโปรดทราบ และอนุมัติชั่วโมงกิจกรรม</p>
        <table border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:38%;"></td>
            <td style="width:62%; text-align:center; line-height:1.4;">
              ลงชื่อ..................................................<br>
              (${esc(cfg.tName)})<br>
              ตำแหน่ง ${esc(cfg.tPos)}
            </td>
          </tr>
          <tr>
            <td style="width:35%;"></td>
            <td style="width:65%; padding-top:14px; line-height:1.45;">
              &#9744; ทราบ<br>
              &#9744; อนุมัติ<br>
              &#9744; มอบงานทะเบียนบันทึกผลลงในระบบกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)
            </td>
          </tr>
          <tr>
            <td style="width:38%;"></td>
            <td style="width:62%; text-align:center; padding-top:22px; line-height:1.4;">
              (${esc(cfg.director)})<br>
              ผู้อำนวยการ${SCHOOL_NAME}
            </td>
          </tr>
        </table>
        <div style="margin-top:20px; line-height:1.45;">
          <b>สำหรับงานทะเบียน</b><br>
          &nbsp;&nbsp;&nbsp;&nbsp;บันทึกผลลงในระบบเมื่อวันที่........เดือน............พ.ศ. ............<br><br>
          <div style="margin-left:18%;">(..................................................)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;เจ้าหน้าที่งานทะเบียน</div>
        </div>
      </div>`;

    const k4Word = buildKPCH4Html(items, { projName: cfg.projName, sDate: cfg.sDate, eDate: cfg.eDate, loc: cfg.loc, tName: cfg.tName }, true);
    const k5Word = buildKPCH5Html(first, false, uniqueImgs, cfg.director, true);
    const k6Word = items.map((s, idx) => `
      <div style="font-size:15pt; line-height:1.5;">
        ${wordBoxTagHtml('กพช. 6')}
        <div style="text-align:center; font-weight:bold; font-size:17pt; line-height:1.25;">ใบแจ้งผลกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับสถานศึกษา)</div>
        <div style="margin-top:14px; line-height:1.6;">
          ชื่อสถานศึกษา &nbsp; <b>${SCHOOL_NAME}</b><br>
          รหัสประจำตัวนักศึกษา &nbsp; <b>${esc(s.student_id)}</b> &nbsp;&nbsp; ชื่อ-สกุล &nbsp; <b>${esc(s.student_name)}</b><br>
          ระดับการศึกษา &nbsp; <b>${esc(s.level || '')}</b> &nbsp;&nbsp; ศูนย์การเรียนรู้ระดับตำบล &nbsp; <b>${esc(s.group_name || '-')}</b><br>
          ครูผู้รับผิดชอบ &nbsp; <b>${esc(cfg.tName)}</b>
        </div>
        <table border="1" cellspacing="0" cellpadding="4" style="width:100%; border-collapse:collapse; margin-top:12px; font-size:14.5pt;">
          <thead>
            <tr>
              <th style="border:1px solid #000; text-align:center; padding:4px;">โครงการ/กิจกรรม</th>
              <th style="border:1px solid #000; width:90px; text-align:center; padding:4px;">ผ่าน</th>
              <th style="border:1px solid #000; width:120px; text-align:center; padding:4px;">จำนวนชั่วโมง</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #000; padding:3px 6px;">1. ${esc(s.activity_name || cfg.projName)}</td><td style="border:1px solid #000; text-align:center;">&#10004;</td><td style="border:1px solid #000; text-align:center;">${esc(s.hours || cfg.hours)}</td></tr>
            <tr><td style="border:1px solid #000; padding:3px 6px;">2. ............................................................................</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; padding:3px 6px;">3. ............................................................................</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; padding:3px 6px;">4. ............................................................................</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; padding:3px 6px;">5. ............................................................................</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; padding:3px 6px;">6. ............................................................................</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
            <tr><td style="border:1px solid #000; text-align:center; font-weight:bold; padding:3px 6px;">รวม</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000; text-align:center; font-weight:bold;">${esc(s.hours || cfg.hours)}</td></tr>
          </tbody>
        </table>
        <div style="margin-top:16px;">อนุมัติการผ่านกิจกรรม เมื่อวันที่............เดือน..................พ.ศ. ............</div>
        <table border="0" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; margin-top:26px;">
          <tr>
            <td style="width:50%; text-align:center; vertical-align:top;">ลงชื่อ..........................................ผู้กรอก<br>(${esc(cfg.filler || '..........................................')})<br>ตำแหน่ง..........................................</td>
            <td style="width:50%; text-align:center; vertical-align:top;">ลงชื่อ..........................................ผู้ทาน<br>(${esc(cfg.checker || '..........................................')})<br>ตำแหน่ง..........................................</td>
          </tr>
        </table>
        <div style="text-align:center; margin-top:26px;">ลงชื่อ..........................................นายทะเบียน<br>(${esc(cfg.regName || '..........................................')})</div>
      </div>
      ${idx === items.length - 1 ? '' : wordPageBreak()}`).join('');

    return memoWord + wordPageBreak() + k4Word + wordPageBreak() + k5Word + k6Word;
  }

  const memoHtml = `
    <div class="memo-page">
      <div class="memo-header"><img src="${esc(garudaSrc)}" class="memo-garuda" onerror="this.style.display='none'"><div class="memo-title">บันทึกข้อความ</div></div>
      <div class="memo-field"><b>ส่วนราชการ</b> &nbsp; ${SCHOOL_NAME} &nbsp;&nbsp;&nbsp; <b>โทร.</b> 02 524 0645</div>
      <div class="memo-field" style="display:flex; justify-content:space-between;"><span><b>ที่</b> &nbsp; ${esc(cfg.docNo)}</span><span><b>วันที่</b> &nbsp; ${esc(cfg.docDate)} &nbsp;&nbsp;&nbsp;&nbsp;</span></div>
      <div class="memo-field"><b>เรื่อง</b> &nbsp; รายงานผลสำเร็จโครงการกิจกรรมพัฒนาคุณภาพชีวิตและขออนุมัติชั่วโมงกิจกรรม</div>
      <div class="memo-divider"></div>
      <div class="memo-field" style="margin-bottom:8px;"><b>เรียน</b> &nbsp; ผู้อำนวยการ${SCHOOL_NAME}</div>
      <div class="memo-indent">ตามที่นักศึกษา ${SCHOOL_NAME} ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย จำนวน ${items.length} คน ได้เสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต โครงการ/กิจกรรม ${esc(cfg.projName)} ระหว่างวันที่ ${cfg.sDate} ถึงวันที่ ${cfg.eDate} สถานที่ปฏิบัติกิจกรรม ${esc(cfg.loc)} โดยได้รับอนุมัติชั่วโมงกิจกรรม จำนวน ${esc(cfg.hours)} ชั่วโมง นั้น</div>
      <div class="memo-indent">ในการนี้ การปฏิบัติกิจกรรมตามโครงการได้เสร็จสิ้นเรียบร้อยแล้ว มีนักศึกษาเข้าร่วมโครงการและปฏิบัติกิจกรรมดังกล่าวโดยผ่านกิจกรรมจำนวน ${esc(cfg.passCount)} คน และไม่ผ่านกิจกรรมจำนวน ${esc(cfg.failCount)} คน และข้าพเจ้าได้ตรวจสอบเอกสารแล้ว มีความครบถ้วนถูกต้อง ทั้งนี้ได้แนบภาพถ่ายและใบลงชื่อมาด้วยแล้ว</div>
      <div class="memo-indent">จึงเรียนมาเพื่อโปรดทราบ และอนุมัติชั่วโมงกิจกรรม</div>
      <div class="sig-center" style="margin-left:38%;">ลงชื่อ..................................................<br>(${esc(cfg.tName)})<br>ตำแหน่ง ${esc(cfg.tPos)}</div>
      <div style="margin-left:35%; margin-top:14px; line-height:1.4;">&#9744; ทราบ<br>&#9744; อนุมัติ<br>&#9744; มอบงานทะเบียนบันทึกผลลงในระบบกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)</div>
      <div class="sig-center" style="margin-left:38%; margin-top:24px;">(${esc(cfg.director)})<br>ผู้อำนวยการ${SCHOOL_NAME}</div>
      <div style="margin-top:20px;"><b>สำหรับงานทะเบียน</b><br>&nbsp;&nbsp;&nbsp;&nbsp;บันทึกผลลงในระบบเมื่อวันที่........เดือน............พ.ศ. ............<br><br><div style="margin-left:18%;">(..................................................)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;เจ้าหน้าที่งานทะเบียน</div></div>
    </div>`;

  const k4Html = buildKPCH4Html(items, { projName: cfg.projName, sDate: cfg.sDate, eDate: cfg.eDate, loc: cfg.loc, tName: cfg.tName }, false);
  const k5Html = buildKPCH5Html(first, false, uniqueImgs, cfg.director, false);
  const k6Html = items.map((s, idx) => `
    <div class="${idx === items.length - 1 ? '' : 'memo-page'}">
      <div class="kpch-box-tag">กพช. 6</div>
      <div class="doc-title-center">ใบแจ้งผลกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับสถานศึกษา)</div>
      <div style="margin-top:14px; line-height:1.6;">
        ชื่อสถานศึกษา &nbsp; <b>${SCHOOL_NAME}</b><br>
        รหัสประจำตัวนักศึกษา &nbsp; <b>${esc(s.student_id)}</b> &nbsp;&nbsp; ชื่อ-สกุล &nbsp; <b>${esc(s.student_name)}</b><br>
        ระดับการศึกษา &nbsp; <b>${esc(s.level || '')}</b> &nbsp;&nbsp; ศูนย์การเรียนรู้ระดับตำบล &nbsp; <b>${esc(s.group_name || '-')}</b><br>
        ครูผู้รับผิดชอบ &nbsp; <b>${esc(cfg.tName)}</b>
      </div>
      <table class="doc-table" style="margin-top:12px;">
        <thead><tr><th>โครงการ/กิจกรรม</th><th style="width:90px;">ผ่าน</th><th style="width:120px;">จำนวนชั่วโมง</th></tr></thead>
        <tbody>
          <tr><td>1. ${esc(s.activity_name || cfg.projName)}</td><td style="text-align:center;">&#10004;</td><td style="text-align:center;">${esc(s.hours || cfg.hours)}</td></tr>
          <tr><td>2. ............................................................................</td><td></td><td></td></tr>
          <tr><td>3. ............................................................................</td><td></td><td></td></tr>
          <tr><td>4. ............................................................................</td><td></td><td></td></tr>
          <tr><td>5. ............................................................................</td><td></td><td></td></tr>
          <tr><td>6. ............................................................................</td><td></td><td></td></tr>
          <tr><td style="text-align:center; font-weight:bold;">รวม</td><td></td><td style="text-align:center; font-weight:bold;">${esc(s.hours || cfg.hours)}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:16px;">อนุมัติการผ่านกิจกรรม เมื่อวันที่............เดือน..................พ.ศ. ............</div>
      <div class="sig-row-2" style="margin-top:28px;">
        <div class="sig-col">ลงชื่อ..........................................ผู้กรอก<br>(${esc(cfg.filler || '..........................................')})<br>ตำแหน่ง..........................................</div>
        <div class="sig-col">ลงชื่อ..........................................ผู้ทาน<br>(${esc(cfg.checker || '..........................................')})<br>ตำแหน่ง..........................................</div>
      </div>
      <div class="sig-center" style="margin-top:26px;">ลงชื่อ..........................................นายทะเบียน<br>(${esc(cfg.regName || '..........................................')})</div>
    </div>`).join('');

  return memoHtml + k4Html + k5Html + k6Html;
}

async function executeOutputDoc57(mode = 'print') {
  if (_doc57TargetIds.length === 0) return;
  closeModalById('doc57Modal');
  showLoading(mode === 'word'
    ? `กำลังเตรียมไฟล์ Word ชุด กพช. 4-6 (${_doc57TargetIds.length} รายการ)...`
    : `กำลังจัดชุด กพช. 4-6 (${_doc57TargetIds.length} รายการ)...`);
  try {
    const batchData = await callApi('getSubmissionsBatchForPrint', { token: authToken, req_ids: _doc57TargetIds });
    if (!batchData || batchData.length === 0) {
      hideLoading();
      return safeAlert('ไม่พบข้อมูล', 'ไม่สามารถดึงข้อมูลสำหรับออกเอกสารได้', 'warning');
    }
    const items = batchData.map(b => b.item), first = items[0];
    const cfg = {
      docNo: document.getElementById('d57_doc_no').value.trim(),
      docDate: document.getElementById('d57_doc_date').value.trim(),
      projName: document.getElementById('d57_project_name').value.trim(),
      loc: document.getElementById('d57_location').value.trim(),
      passCount: document.getElementById('d57_pass_count').value,
      failCount: document.getElementById('d57_fail_count').value,
      hours: document.getElementById('d57_hours').value,
      tName: document.getElementById('d57_teacher_name').value.trim(),
      tPos: document.getElementById('d57_teacher_pos').value.trim(),
      filler: document.getElementById('d57_filler').value.trim(),
      checker: document.getElementById('d57_checker').value.trim(),
      regName: document.getElementById('d57_registrar').value.trim(),
      director: document.getElementById('d57_director').value.trim(),
      sDate: formatThaiDateWithLabel(first.activity_date),
      eDate: formatThaiDateWithLabel(first.activity_end_date)
    };

    if (mode === 'word') {
      const garudaSrc = await getGarudaForWord();
      hideLoading();
      markPrintedClient('46', _doc57TargetIds);
      const wordHtml = buildDoc57Html(batchData, cfg, true, garudaSrc);
      exportHtmlToWord(`กพช4-6_บันทึกข้อความ_${first.student_id || 'group'}`, wordHtml);
    } else {
      hideLoading();
      document.getElementById('printOnlyContainer').innerHTML = buildDoc57Html(batchData, cfg, false, GARUDA_URL);
      markPrintedClient('46', _doc57TargetIds);
      triggerPrint();
    }
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function executePrintDoc57() {
  return executeOutputDoc57('print');
}

function openDetailModal(reqId) {
  const item = dashItems.find(x => x.req_id === reqId);
  if (!item) return;
  document.getElementById('mdReqId').innerText = item.req_id;
  const imgs = [item.img_1, item.img_2, item.img_3].filter(Boolean);
  const imgsHtml = imgs.map((url, idx) => `<div class="col-6 col-md-4"><a href="${esc(url)}" target="_blank"><img src="${getDriveThumb(url)}" class="img-fluid rounded-3 border" style="height:140px; width:100%; object-fit:cover;"></a><div class="text-center small text-muted mt-1">ภาพที่ ${idx + 1}</div></div>`).join('');
  const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
  document.getElementById('detailModalBody').innerHTML = `
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2"><div><span class="badge step-badge ${st.cls}">${st.text}</span> ${item.category ? `<span class="badge bg-info bg-opacity-10 text-dark border ms-1">${esc(item.category)}</span>` : ''}</div><span class="text-muted small">ส่งเมื่อ: ${esc(item.created_at)}</span></div>
    <div class="row g-2 mb-3 bg-light p-3 rounded-3 small">
      <div class="col-12 col-md-6"><b>นักศึกษา:</b> ${esc(item.student_name)} (${esc(item.student_id)})</div>
      <div class="col-12 col-md-6"><b>ระดับชั้น:</b> ${esc(item.level)} | <b>กลุ่ม:</b> ${esc(item.group_name || '-')}</div>
      <div class="col-12 col-md-6"><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</div>
      <div class="col-12 col-md-6"><b>จำนวนชั่วโมงที่ขอ:</b> ${esc(item.hours)} ชั่วโมง</div>
      <div class="col-12 col-md-6"><b>วันที่:</b> ${formatShortThaiDate(item.activity_date)} ถึง ${formatShortThaiDate(item.activity_end_date)}</div>
      <div class="col-12 col-md-6"><b>สถานที่:</b> ${esc(item.location || '-')}</div>
    </div>
    <h6 class="fw-bold">ชื่อกิจกรรม/โครงการ:</h6><p>${esc(item.activity_name)}</p>
    <h6 class="fw-bold">รายละเอียดการปฏิบัติกิจกรรม (กพช.4):</h6>
    <p class="border p-3 rounded-3 bg-white detail-text-box">${esc(item.activity_detail)}</p>
    <h6 class="fw-bold mt-3">ภาพถ่ายกิจกรรม:</h6><div class="row g-2 mb-3">${imgsHtml}</div>
    ${item.reject_reason ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(item.reject_reason)}</div>` : ''}
  `;
  const canAct = item.current_step === 'WAIT_TEACHER' && ['TEACHER', 'ADMIN'].includes(currentUser.role), isAdmin = currentUser.role === 'ADMIN';
  document.getElementById('detailModalFooter').innerHTML = `
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="closeModalById('detailModal'); setTimeout(() => printSingle46('${escJs(item.req_id)}'), 220)"><i class="bi bi-printer me-1"></i>พิมพ์ / โหลด Word กพช. 4-6</button>
      ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDeleteSubmissions(['${escJs(item.req_id)}'])"><i class="bi bi-trash me-1"></i>ย้ายลงถังขยะ</button>` : ''}
    </div>
    <div class="d-flex flex-wrap gap-2">
      ${canAct ? `<button type="button" class="btn btn-danger rounded-pill px-3 fw-bold" onclick="submitDecision('${escJs(item.req_id)}', 'REJECT')"><i class="bi bi-x-circle me-1"></i>ตีกลับ (ระบุเหตุผล)</button><button type="button" class="btn btn-success rounded-pill px-3 fw-bold" onclick="submitDecision('${escJs(item.req_id)}', 'APPROVE')"><i class="bi bi-check-circle me-1"></i>อนุมัติส่งนายทะเบียน</button>` : ''}
      <button type="button" class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">ปิด</button>
    </div>`;
  openModalById('detailModal');
}

function submitDecision(reqId, decision) {
  closeModalById('detailModal');
  setTimeout(() => {
    if (decision === 'APPROVE') {
      Swal.fire({ title: 'ยืนยันอนุมัติและส่งนายทะเบียน?', text: `คำขอ ${reqId} จะถูกส่งตรงไปยังนายทะเบียนทันที`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยันอนุมัติ', confirmButtonColor: '#10b981' }).then(res => { if (res.isConfirmed) executeApproval(reqId, 'APPROVE', ''); });
    } else {
      Swal.fire({ title: 'ระบุเหตุผลในการตีกลับ', input: 'textarea', inputPlaceholder: 'เช่น รูปภาพไม่ชัดเจน, กรอกข้อมูล กพช.4 ไม่ครบ, ชั่วโมงผิด...', showCancelButton: true, confirmButtonText: 'ส่งตีกลับ', confirmButtonColor: '#ef4444', inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; } }).then(res => { if (res.isConfirmed) executeApproval(reqId, 'REJECT', res.value); });
    }
  }, 220);
}

async function executeApproval(reqId, decision, reason) {
  showLoading('กำลังบันทึกผลการพิจารณา...');
  try { await callApi('processApproval', { token: authToken, req_id: reqId, decision, reason }); hideLoading(); safeAlert('สำเร็จ', 'บันทึกผลเรียบร้อยแล้ว', 'success'); await loadDashboard(); }
  catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

// ==================== นายทะเบียน (ดึงรายชื่อรายครู) & แอดมิน ====================
function exportRegistrarCSV() {
  const approved = currentFilteredSubs.filter(x => x.current_step === 'APPROVED_FOR_REGISTRAR');
  if (approved.length === 0) return safeAlert('แจ้งเตือน', 'ไม่มีรายการที่รอลงทะเบียนตามเงื่อนไขที่เลือก (ลองเลือกครู/ภาคเรียนด้านบน)', 'info');
  const headers = ['ลำดับ', 'รหัสคำขอ', 'รหัส กพช.1-2', 'ภาคเรียน', 'ประเภท กพช.', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'ระดับชั้น', 'ครูประจำกลุ่ม', 'ชื่อกิจกรรม', 'วันที่เริ่ม', 'วันสิ้นสุด', 'สถานที่', 'จำนวนชั่วโมง', 'วันที่ครูอนุมัติ'];
  const csvEscape = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const lines = [headers.map(csvEscape).join(',')];
  approved.forEach((r, idx) => { lines.push([idx + 1, r.req_id, r.ref_12_id || '-', getItemTerm(r) || '-', r.category || '-', r.student_id, r.student_name, r.level, r.teacher_name, r.activity_name, formatShortThaiDate(r.activity_date), formatShortThaiDate(r.activity_end_date), r.location, r.hours, r.teacher_approved_at || '-'].map(csvEscape).join(',')); });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `รายชื่ออนุมัติ_กพช_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function confirmRegistrarComplete() {
  const checkedIds = getCheckedUniqueIds('reg-check');
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && it.current_step === 'APPROVED_FOR_REGISTRAR'; });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่รอนายทะเบียน', 'warning');
  Swal.fire({ title: `ยืนยันปิดงาน ${validIds.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยัน' }).then(async res => {
    if (res.isConfirmed) { showLoading('กำลังอัปเดต...'); try { const r = await callApi('markRegistrarCompleted', { token: authToken, req_ids: validIds }); hideLoading(); safeAlert('เรียบร้อย', `ปิดงานสำเร็จ ${r.count} รายการ`, 'success'); await loadDashboard(); } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); } }
  });
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('#adminNavTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dashSubmissionsView').classList.toggle('d-none', tab !== 'subs');
  document.getElementById('dash12View').classList.toggle('d-none', tab !== 'req12');
  document.getElementById('adminCategoriesView').classList.toggle('d-none', tab !== 'categories');
  document.getElementById('adminUsersView').classList.toggle('d-none', tab !== 'users');
  document.getElementById('adminAnnView').classList.toggle('d-none', tab !== 'ann');
  document.getElementById('adminLogsView').classList.toggle('d-none', tab !== 'logs');
  document.getElementById('adminTrashView')?.classList.toggle('d-none', tab !== 'trash');
}

function renderAdminTrash() {
  const subsBody = document.getElementById('trashSubsBody'), req12Body = document.getElementById('trash12Body');
  if (subsBody) subsBody.innerHTML = adminTrashSubs.length === 0 ? '<tr><td colspan="6" class="text-center py-4 text-muted">ไม่มีรายการในถังขยะ</td></tr>' : adminTrashSubs.map(item => `<tr><td><b>${esc(item.req_id)}</b></td><td>${esc(item.student_name)} (${esc(item.student_id)})</td><td>${esc(item.activity_name)}</td><td>${esc(item.current_step)}</td><td class="small">${esc(item.deleted_at)}<br>${esc(item.deleted_by)}</td><td class="text-end text-nowrap"><button class="btn btn-success btn-sm rounded-pill me-1" onclick="confirmRestoreTrash('SUB', '${escJs(item.req_id)}')">♻️ กู้คืน</button><button class="btn btn-outline-danger btn-sm rounded-pill" onclick="confirmPurgeTrash('SUB', '${escJs(item.req_id)}')">🔥 ลบถาวร</button></td></tr>`).join('');
  if (req12Body) req12Body.innerHTML = adminTrash12.length === 0 ? '<tr><td colspan="6" class="text-center py-4 text-muted">ไม่มีรายการในถังขยะ</td></tr>' : adminTrash12.map(item => `<tr><td><b>${esc(item.req12_id)}</b></td><td>${esc(item.student_name)} (${esc(item.student_id)})</td><td>${esc(item.activity_name)}</td><td>${esc(item.status_12)}</td><td class="small">${esc(item.deleted_at)}<br>${esc(item.deleted_by)}</td><td class="text-end text-nowrap"><button class="btn btn-success btn-sm rounded-pill me-1" onclick="confirmRestoreTrash('12', '${escJs(item.req12_id)}')">♻️ กู้คืน</button><button class="btn btn-outline-danger btn-sm rounded-pill" onclick="confirmPurgeTrash('12', '${escJs(item.req12_id)}')">🔥 ลบถาวร</button></td></tr>`).join('');
}

function confirmRestoreTrash(trashType, itemId) {
  Swal.fire({ title: `♻️ กู้คืน ${esc(itemId)}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'กู้คืน', confirmButtonColor: '#10b981' }).then(async res => {
    if (res.isConfirmed) { showLoading('กำลังกู้คืน...'); try { await callApi('restoreTrash', { token: authToken, trash_type: trashType, item_id: itemId }); hideLoading(); await loadDashboard(); } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); } }
  });
}

function confirmPurgeTrash(trashType, itemId) {
  Swal.fire({ title: `🔥 ยืนยันลบถาวร ${esc(itemId)}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบถาวร', confirmButtonColor: '#dc2626' }).then(async res => {
    if (res.isConfirmed) { showLoading('กำลังลบถาวร...'); try { await callApi('purgeTrash', { token: authToken, trash_type: trashType, item_id: itemId }); hideLoading(); await loadDashboard(); } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); } }
  });
}

function renderAdminUsers() {
  document.getElementById('adminUsersBody').innerHTML = adminUsers.map(u => `<tr><td>${esc(u.user_id)}</td><td><b>${esc(u.username)}</b></td><td>${esc(u.full_name)}</td><td><span class="badge bg-info text-dark">${ROLE_LABELS[u.role] || u.role}</span></td><td>${esc(u.group_name)}</td><td><span class="badge ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}">${esc(u.status)}</span></td><td><button type="button" class="btn btn-warning btn-sm rounded-pill" onclick="openUserModal('${escJs(u.user_id)}')"><i class="bi bi-pencil"></i> แก้ไข</button></td></tr>`).join('');
}

function renderAdminLogs() {
  document.getElementById('adminLogsBody').innerHTML = adminLogs.map(l => `<tr><td class="text-nowrap">${esc(l.timestamp)}</td><td><b>${esc(l.req_id)}</b></td><td>${esc(l.actor_name)}</td><td>${esc(l.actor_role)}</td><td><span class="badge bg-secondary">${esc(l.action)}</span></td><td>${esc(l.remark)}</td></tr>`).join('');
}

function openUserModal(userId) {
  const isEdit = !!userId;
  document.getElementById('userModalTitle').innerText = isEdit ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่';
  document.getElementById('u_username').readOnly = isEdit;
  document.getElementById('u_pass_hint').innerText = isEdit ? '(เว้นว่างหากไม่เปลี่ยน)' : '(จำเป็น)';
  document.getElementById('u_status_wrap').classList.toggle('d-none', !isEdit);
  if (isEdit) {
    const u = adminUsers.find(x => x.user_id === userId);
    if (!u) return;
    document.getElementById('u_id').value = u.user_id; document.getElementById('u_username').value = u.username;
    document.getElementById('u_fullname').value = u.full_name; document.getElementById('u_role').value = u.role;
    document.getElementById('u_group').value = u.group_name; document.getElementById('u_status').value = u.status;
    document.getElementById('u_password').value = '';
  } else {
    ['u_id', 'u_username', 'u_fullname', 'u_group', 'u_password'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('u_role').value = 'TEACHER'; document.getElementById('u_status').value = 'ACTIVE';
  }
  openModalById('userModal');
}

async function handleSaveUser() {
  const uid = document.getElementById('u_id').value, uname = document.getElementById('u_username').value.trim(), fname = document.getElementById('u_fullname').value.trim(), pass = document.getElementById('u_password').value;
  if (!uname || !fname || (!uid && !pass)) return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ', 'warning');
  showLoading('กำลังบันทึกบุคลากร...');
  try {
    await callApi('saveUserAdmin', { token: authToken, user_data: { user_id: uid, username: uname, full_name: fname, role: document.getElementById('u_role').value, group_name: document.getElementById('u_group').value.trim(), new_password: pass, status: document.getElementById('u_status').value } });
    hideLoading(); closeModalById('userModal'); safeAlert('สำเร็จ', 'บันทึกบุคลากรเรียบร้อยแล้ว', 'success'); await loadDashboard();
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

async function handleSaveAnnouncement() {
  const fileInput = document.getElementById('ann_pdf_file'), file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (file && file.size > 8 * 1024 * 1024) return safeAlert('ไฟล์ใหญ่เกินไป', 'เลือกไฟล์ PDF ไม่เกิน 8 MB', 'warning');
  showLoading('กำลังบันทึกข่าวประกาศ...');
  try {
    let pdfFilePayload = null;
    if (file) pdfFilePayload = { name: file.name, base64Data: await readFileAsBase64(file) };
    const res = await callApi('saveAnnouncement', { token: authToken, announcement: { visible: document.getElementById('ann_visible').checked, badge: document.getElementById('ann_badge').value.trim(), content: document.getElementById('ann_content').value.trim(), remove_pdf: document.getElementById('ann_remove_pdf')?.checked || false, pdf_file: pdfFilePayload } });
    hideLoading(); renderAnnouncement(res.announcement); renderAdminAnnPdfBox(res.announcement); safeAlert('สำเร็จ', 'อัปเดตข่าวประกาศเรียบร้อยแล้ว', 'success');
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

async function handleChangeMyPassword() {
  const oldPass = document.getElementById('cp_old').value, newPass = document.getElementById('cp_new').value, confirmPass = document.getElementById('cp_confirm').value;
  if (!oldPass || !newPass || newPass.length < 4 || newPass !== confirmPass) return safeAlert('แจ้งเตือน', 'กรุณากรอกรหัสผ่านให้ถูกต้องและตรงกัน (อย่างน้อย 4 ตัวอักษร)', 'warning');
  showLoading('กำลังเปลี่ยนรหัสผ่าน...');
  try { await callApi('changePassword', { token: authToken, old_pass: oldPass, new_pass: newPass }); hideLoading(); ['cp_old', 'cp_new', 'cp_confirm'].forEach(id => document.getElementById(id).value = ''); closeModalById('changePassModal'); safeAlert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success'); }
  catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

// ==================== เริ่มทำงาน ====================
function initApp() {
  const preloadGaruda = new Image(); preloadGaruda.src = GARUDA_URL;
  renderNavbar();
  const savedToken = sessionStorage.getItem('kpch_token');
  if (savedToken) {
    authToken = savedToken;
    loadDashboard(true);
  } else {
    loadPublicData();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();
