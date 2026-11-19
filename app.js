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
  'ท่านได้รับความรู้ในเรื่องกระบวนการคิดเป็น ทำเป็น แก้ปัญหาเป็น และการนำไปใช้ในการดำเนินชีวิตใน ระดับใด',
  'ท่านได้รับความรู้ในเรื่องการประสานเครือข่ายในระดับ ใด',
  'ท่านได้รับความรู้ในเรื่องการเป็นผู้นำผู้ตามในระดับใด',
  'ท่านมีความรู้ในเรื่องการวางแผน และประโยชน์ของการ วางแผนในระดับใด',
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
let presentSubMode = 'WAIT';
let currentEligibleList12 = [];
let currentFilteredSubs = [];
let currentFiltered12 = [];

const STEP_LABELS = {
  'WAIT_TEACHER': { text: 'รอครูประจำกลุ่มอนุมัติ', cls: 'bg-warning text-dark' },
  'WAIT_COMM_1': { text: 'รอกรรมการ 1 อนุมัติ', cls: 'bg-info text-dark' },
  'WAIT_COMM_2': { text: 'รอกรรมการ 2 อนุมัติ', cls: 'bg-info text-dark' },
  'WAIT_COMM_3': { text: 'รอกรรมการ 3 อนุมัติ', cls: 'bg-info text-dark' },
  'WAIT_DIRECTOR': { text: 'รอ ผอ. อนุมัติโครงการ', cls: 'bg-primary text-white' },
  'WAIT_TEACHER_PRESENT': { text: 'ผอ.อนุมัติแล้ว (รอครูนำเสนอส่งทะเบียน)', cls: 'bg-info text-dark' },
  'APPROVED_FOR_REGISTRAR': { text: 'ส่งต่อทะเบียนแล้ว (รอนายทะเบียน)', cls: 'bg-success text-white' },
  'COMPLETED': { text: 'บันทึกทะเบียนเรียบร้อย', cls: 'bg-dark text-white' },
  'REJECTED': { text: 'ถูกตีกลับให้แก้ไข', cls: 'bg-danger text-white' }
};

const STEP12_LABELS = {
  'WAIT_TEACHER_12': { text: 'รอครูอนุมัติ กพช.1-3', cls: 'bg-warning text-dark' },
  'APPROVED_12': { text: 'อนุมัติให้ทำกิจกรรมแล้ว', cls: 'bg-success text-white' },
  'REJECTED_12': { text: 'ถูกตีกลับให้แก้ไข กพช.1-3', cls: 'bg-danger text-white' }
};

const ROLE_LABELS = {
  'TEACHER': 'ครูประจำกลุ่ม',
  'COMM_1': 'ครูศูนย์การเรียนรู้',
  'COMM_2': 'ครูศูนย์การเรียนรู้',
  'COMM_3': 'ครูศูนย์การเรียนรู้',
  'DIRECTOR': 'ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง',
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
function getDriveThumb(url) {
  if (!url) return '';
  const m = url.match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/thumbnail?id=${m[0]}&sz=w800` : url;
}
function formatThaiDate(dateInput) {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (!dateInput) {
    const d = new Date();
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  const datePart = String(dateInput).split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && months[m]) {
      return `${d} ${months[m]} ${y < 2400 ? y + 543 : y}`;
    }
  }
  return String(dateInput);
}
function formatThaiDateWithLabel(dateInput) {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (!dateInput) return '......เดือน............พ.ศ.........';
  const datePart = String(dateInput).split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && months[m]) {
      return `${d} เดือน ${months[m]} พ.ศ. ${y < 2400 ? y + 543 : y}`;
    }
  }
  return String(dateInput);
}
function formatShortThaiDate(dateInput) {
  if (!dateInput) return '-';
  const shortMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const datePart = String(dateInput).split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && shortMonths[m]) {
      return `${d} ${shortMonths[m]} ${y < 2400 ? y + 543 : y}`;
    }
  }
  return datePart;
}
function parseTermParts(termVal) {
  const raw = String(termVal || '').replace(/^'/, '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const p = raw.split(' ')[0].split('-');
    const y = parseInt(p[0], 10);
    const m = parseInt(p[1], 10);
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
  let m = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let yearNum, month;
  if (m) { yearNum = parseInt(m[1], 10); month = parseInt(m[2], 10); }
  else {
    m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) { month = parseInt(m[2], 10); yearNum = parseInt(m[3], 10); }
  }
  if (yearNum && month) {
    const thaiYear = yearNum < 2400 ? yearNum + 543 : yearNum;
    if (month >= 5 && month <= 10) return `1/${thaiYear}`;
    if (month >= 11) return `2/${thaiYear}`;
    return `2/${thaiYear - 1}`;
  }
  return '';
}
function matchesTermFilter(itemTerm, filterVal) {
  if (!filterVal || filterVal === 'ALL') return true;
  if (filterVal.startsWith('TERM:')) return itemTerm === filterVal.slice(5);
  if (filterVal.startsWith('YEAR:')) {
    const targetYear = filterVal.slice(5);
    return String(itemTerm || '').split('/')[1] === targetYear;
  }
  return true;
}
function populateTermDropdown(selectEl, items, termGetter) {
  if (!selectEl) return;
  const prev = selectEl.value || 'ALL';
  const termSet = new Set();
  const yearSet = new Set();
  items.forEach(it => {
    const t = termGetter(it);
    if (t && t.includes('/')) {
      termSet.add(t);
      const y = t.split('/')[1];
      if (y && /^\d{4}$/.test(y)) yearSet.add(y);
    }
  });
  const terms = Array.from(termSet).sort((a, b) => {
    const [ta, ya] = a.split('/').map(Number);
    const [tb, yb] = b.split('/').map(Number);
    return yb !== ya ? yb - ya : tb - ta;
  });
  const years = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  let html = '<option value="ALL">📅 ทุกภาคเรียน</option>';
  if (terms.length > 0) {
    html += '<optgroup label="เลือกตามภาคเรียน">' + terms.map(t => `<option value="TERM:${esc(t)}">ภาคเรียนที่ ${esc(t)}</option>`).join('') + '</optgroup>';
  }
  if (years.length > 0) {
    html += '<optgroup label="รวมทั้งปีการศึกษา">' + years.map(y => `<option value="YEAR:${esc(y)}">รวมปีการศึกษา ${esc(y)}</option>`).join('') + '</optgroup>';
  }
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
  if (currentUser) {
    area.innerHTML = `
      <span class="text-white small">
        <i class="bi bi-person-circle me-1"></i>${esc(currentUser.full_name)}
        <span class="badge bg-warning text-dark rounded-pill ms-1">${ROLE_LABELS[currentUser.role] || currentUser.role}</span>
      </span>
      <button type="button" class="btn btn-outline-light btn-sm rounded-pill px-3" onclick="handleLogout()">
        <i class="bi bi-box-arrow-right me-1"></i>ออก
      </button>
    `;
  } else {
    area.innerHTML = `
      <button type="button" class="btn btn-light btn-sm rounded-pill px-3 fw-bold text-primary shadow-sm" onclick="openModalById('loginModal')">
        <i class="bi bi-box-arrow-in-right me-1"></i>เข้าสู่ระบบเจ้าหน้าที่
      </button>
    `;
  }
}

// ==================== ประเภท กพช. (โหลด & จัดการสำหรับแอดมิน/ครู/นศ.) ====================
function populateCategorySelects() {
  const activeCats = kpchCategories.filter(c => c.status !== 'INACTIVE');
  const studentOpts = '<option value="">-- เลือกประเภท กพช. --</option>' +
    activeCats.map(c => `<option value="${esc(c.cat_name)}">${esc(c.cat_name)}</option>`).join('');
  const filterOpts = '<option value="ALL">🏷️ ทุกประเภท กพช.</option>' +
    kpchCategories.map(c => `<option value="${esc(c.cat_name)}">${esc(c.cat_name)}</option>`).join('');

  ['p12_category', 'f_category', 'se_category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const prev = el.value;
      el.innerHTML = studentOpts;
      if (prev) el.value = prev;
    }
  });
  ['dashCategoryFilter', 'dash12CategoryFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const prev = el.value;
      el.innerHTML = filterOpts;
      if (Array.from(el.options).some(o => o.value === prev)) el.value = prev;
    }
  });
}

function onSelectKpchCategory(prefix) {
  const catName = document.getElementById(`${prefix}_category`)?.value;
  const cat = kpchCategories.find(c => c.cat_name === catName);
  if (!cat) return;
  const actEl = document.getElementById(`${prefix}_activity_name`);
  if (actEl && !actEl.value && cat.default_project) actEl.value = cat.default_project;
  if (prefix === 'p12') {
    const ratEl = document.getElementById('p3_rationale');
    if (ratEl && !ratEl.value && cat.default_rationale) ratEl.value = cat.default_rationale;
  } else if (prefix === 'f') {
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
      <td>${esc(c.cat_id)}</td>
      <td class="fw-semibold">${esc(c.cat_name)}</td>
      <td>${esc(c.default_project || '-')}</td>
      <td class="text-center">${esc(c.default_hours || 25)}</td>
      <td><span class="badge ${c.status === 'INACTIVE' ? 'bg-secondary' : 'bg-success'}">${esc(c.status)}</span></td>
      <td class="text-end text-nowrap">
        <button type="button" class="btn btn-warning btn-sm rounded-pill" onclick="openCategoryModal('${esc(c.cat_id)}')"><i class="bi bi-pencil"></i> แก้ไข</button>
        <button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="confirmDeleteCategory('${esc(c.cat_id)}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
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
        cat_id: document.getElementById('cat_id').value,
        cat_name: catName,
        default_project: document.getElementById('cat_default_project').value.trim(),
        default_hours: document.getElementById('cat_default_hours').value,
        default_rationale: document.getElementById('cat_default_rationale').value.trim(),
        status: document.getElementById('cat_status').value
      }
    });
    hideLoading();
    kpchCategories = res.categories || [];
    populateCategorySelects();
    renderAdminCategories();
    closeModalById('categoryModal');
    safeAlert('สำเร็จ', 'บันทึกประเภท กพช. ลง Google Sheet เรียบร้อยแล้ว', 'success');
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

function confirmDeleteCategory(catId) {
  Swal.fire({
    title: 'ยืนยันลบประเภท กพช. นี้?',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังลบประเภท กพช....');
      try {
        const r = await callApi('deleteCategoryAdmin', { token: authToken, cat_id: catId });
        hideLoading();
        kpchCategories = r.categories || [];
        populateCategorySelects();
        renderAdminCategories();
      } catch (err) {
        hideLoading();
        safeAlert('ผิดพลาด', err.message, 'error');
      }
    }
  });
}

// ==================== เติมข้อความมาตรฐาน กพช.3 & กพช.4 ====================
function fillDefaultKpch3Template() {
  const act = document.getElementById('p12_activity_name').value.trim() || 'กิจกรรมพัฒนาคุณภาพชีวิต';
  if (!document.getElementById('p3_rationale').value) {
    document.getElementById('p3_rationale').value =
      'กิจกรรมพัฒนาคุณภาพชีวิต (กพช.) เป็นกิจกรรมที่เป็นองค์ประกอบสำคัญส่วนหนึ่งในโครงสร้างที่กำหนดไว้ในหลักเกณฑ์ และวิธีการจัดการศึกษานอกระบบระดับการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 บันทึกความดี มุ่งเน้นให้เกิดการพัฒนาตนเอง กิจกรรมพัฒนาคุณภาพชีวิต บันทึกความดี จะส่งผลต่อการพัฒนาตนเอง ครอบครัว ชุมชน สังคมและประเทศชาติ เพื่อให้ดำรงอยู่ในสังคมอย่างมีความสุข';
  }
  if (!document.getElementById('p3_objectives').value) {
    document.getElementById('p3_objectives').value =
      '3.1 เพื่อเป็นการเปลี่ยนแปลงในการพัฒนาตนเอง ให้มีระเบียบ วินัย และการเสียสละ\n3.2 เพื่อส่งเสริมให้เป็นผู้มีน้ำใจ เสียสละ ในการพัฒนาตนเอง ครอบครัว ชุมชน สังคมและประเทศชาติ';
  }
  if (!document.getElementById('p3_target').value) {
    document.getElementById('p3_target').value =
      'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย';
  }
  if (!document.getElementById('p3_steps').value) {
    document.getElementById('p3_steps').value =
      '5.1 วางแผนการจัดกิจกรรม\n5.2 ปรึกษาอาจารย์ที่ปรึกษา\n5.3 เข้าร่วมโครงการ\n5.4 เสนอโครงการการจัดกิจกรรมฯ ต่อสถานศึกษาเพื่อให้คณะกรรมการพิจารณาอนุมัติโครงการ\n5.5 ดำเนินจัดกิจกรรมตามแผนที่กำหนด สรุปผลและรายงานผลการดำเนินงาน\n5.6 สรุปผลและรายงานผลการดำเนินงาน และขออนุมัติชั่วโมง กพช.';
  }
  if (!document.getElementById('p3_expected').value) {
    document.getElementById('p3_expected').value =
      `นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง ได้รับการพัฒนาตนเอง ในด้านการคิด การกระทำ และการฝึกบันทึก จาก${act} เพื่อเป็นการพัฒนาตนเองในการดำเนินชีวิต สามารถนำความรู้และประสบการณ์ที่ได้รับมาประยุกต์ใช้ในชีวิตประจำวัน`;
  }
}

function fillDefaultKpch4Template() {
  if (!document.getElementById('f_k4_plan').value) {
    document.getElementById('f_k4_plan').value =
      '1. ปรึกษาครูผู้สอนเข้าร่วมกิจกรรม/โครงการ\n2. เตรียมตัวเข้าร่วมกิจกรรมพัฒนาคุณภาพชีวิตของนักศึกษา\n3. พัฒนาการเรียนรู้มุ่งเน้นการพัฒนาชุมชนและสังคม';
  }
  if (!document.getElementById('f_activity_detail').value) {
    document.getElementById('f_activity_detail').value =
      '1. วางแผนการเข้าร่วมกิจกรรม\n2. ปรึกษาครูที่ปรึกษา\n3. เข้าร่วมกิจกรรมการลงทะเบียน\n4. เสนอโครงการการจัดกิจกรรมต่อสถานศึกษาเพื่อให้คณะกรรมการพิจารณาอนุมัติ\n5. ดำเนินจัดกิจกรรมตามแผนที่กำหนด\n6. สรุปและรายงานผลการดำเนินงาน ขออนุมัติชั่วโมง กพช.';
  }
  if (!document.getElementById('f_k4_learning').value) {
    document.getElementById('f_k4_learning').value =
      '1. การวางแผนการเข้าร่วมกิจกรรม\n2. ได้เรียนรู้คุณค่าของการทำความดี การมีน้ำใจ การเสียสละ และการช่วยเหลือผู้อื่นโดยไม่หวังสิ่งตอบแทน\n3. เพื่อได้รับประสบการณ์ในการทำกิจกรรมจิตอาสาและการช่วยเหลือสังคม';
  }
  if (!document.getElementById('f_k4_apply').value) {
    document.getElementById('f_k4_apply').value =
      '1. ได้ทำประโยชน์ให้กับส่วนรวม\n2. นักศึกษาที่ทำกิจกรรมเป็นการพัฒนาตนเอง ในด้านการคิด การกระทำ และการฝึกบันทึก เพื่อเป็นการพัฒนาตนเองในการดำเนินชีวิต เป็นผู้มีจิตสำนึกที่ดี รู้จักเสียสละ มีน้ำใจเอื้อเฟื้อเผื่อแผ่';
  }
}

// ==================== ส่วนหน้าแรก (นักศึกษา) ====================
function switchPublicTab(tab) {
  document.getElementById('tabBtnPre12').classList.toggle('active', tab === 'pre12');
  document.getElementById('tabBtnSubmit').classList.toggle('active', tab === 'submit');
  document.getElementById('tabBtnStatus').classList.toggle('active', tab === 'status');
  document.getElementById('publicPre12View').classList.toggle('d-none', tab !== 'pre12');
  document.getElementById('publicSubmitView').classList.toggle('d-none', tab !== 'submit');
  document.getElementById('publicStatusView').classList.toggle('d-none', tab !== 'status');
}

function renderAnnouncement(ann) {
  const box = document.getElementById('announcementBox');
  const pdfArea = document.getElementById('annPdfArea');
  if (!ann || !ann.visible) {
    box.classList.add('d-none');
    if (pdfArea) { pdfArea.classList.add('d-none'); pdfArea.innerHTML = ''; }
    return;
  }
  box.classList.remove('d-none');
  document.getElementById('annBadgeText').innerText = ann.badge || '';
  document.getElementById('annContentText').innerText = ann.content || '';
  if (pdfArea) {
    if (ann.pdf_url) {
      pdfArea.classList.remove('d-none');
      pdfArea.innerHTML = `<a href="${esc(ann.pdf_url)}" target="_blank" class="btn btn-danger btn-sm rounded-pill px-3 fw-bold shadow-sm"><i class="bi bi-file-earmark-pdf-fill me-1"></i>เปิดอ่าน / ดาวน์โหลดเอกสารแนบ (${esc(ann.pdf_name || 'PDF')})</a>`;
    } else {
      pdfArea.classList.add('d-none');
      pdfArea.innerHTML = '';
    }
  }
}

async function loadPublicData() {
  const sel1 = document.getElementById('p12_teacher_id');
  const sel2 = document.getElementById('f_teacher_id');
  const selEdit = document.getElementById('se_teacher_id');
  const errEl = document.getElementById('teacherLoadError');
  try {
    const data = await callApi('getPublicData');
    errEl.classList.add('d-none');
    renderAnnouncement(data.announcement);

    kpchCategories = data.categories || [];
    populateCategorySelects();

    publicTeachersList = data.teachers || [];
    const html = publicTeachersList.length === 0
      ? '<option value="">-- ยังไม่มีรายชื่อครูในระบบ --</option>'
      : '<option value="">-- กรุณาเลือกครูประจำกลุ่ม --</option>' +
        publicTeachersList.map(t => `<option value="${esc(t.user_id)}">${esc(t.full_name)} (${esc(t.group_name)})</option>`).join('');

    sel1.innerHTML = html;
    sel2.innerHTML = html;
    if (selEdit) selEdit.innerHTML = html;
  } catch (err) {
    const errOpt = '<option value="">-- โหลดรายชื่อครูไม่สำเร็จ --</option>';
    sel1.innerHTML = errOpt;
    sel2.innerHTML = errOpt;
    errEl.innerText = err.message;
    errEl.classList.remove('d-none');
  }
}

function onSelectPre12Teacher() {
  const tid = document.getElementById('p12_teacher_id').value;
  const t = publicTeachersList.find(x => x.user_id === tid);
  if (t && t.group_name) document.getElementById('p12_group_name').value = t.group_name;
}

async function handlePre12Submit() {
  const sid = document.getElementById('p12_student_id').value.trim();
  const sname = document.getElementById('p12_student_name').value.trim();
  const lvl = document.getElementById('p12_level').value;
  const tid = document.getElementById('p12_teacher_id').value;
  const grp = document.getElementById('p12_group_name').value.trim();
  const cat = document.getElementById('p12_category').value;
  const term = document.getElementById('p12_term').value.trim();
  const roleNote = document.getElementById('p12_role_note').value;
  const actName = document.getElementById('p12_activity_name').value.trim();
  const startDate = document.getElementById('p12_start_date').value;
  const endDate = document.getElementById('p12_end_date').value;
  const loc = document.getElementById('p12_location').value.trim();
  const evalOk = document.getElementById('p12_self_eval_ok').checked;

  if (!sid || !sname || !lvl || !tid || !grp || !cat || !actName || !startDate || !endDate) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * และเลือกประเภท กพช. ให้ครบทุกช่อง', 'warning');
  }
  if (endDate < startDate) {
    return safeAlert('วันที่ไม่ถูกต้อง', 'วันที่คาดว่าจะสิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม', 'warning');
  }

  const evalScores = [];
  for (let i = 1; i <= 10; i++) {
    const checked = document.querySelector(`input[name="eval_q${i}"]:checked`);
    if (!checked) return safeAlert('แบบประเมินยังไม่ครบ', `กรุณาเลือกคำตอบในตารางแบบประเมินตนเอง (กพช. 2) ข้อที่ ${i}`, 'warning');
    evalScores.push(checked.value);
  }
  if (!evalOk) return safeAlert('กรุณายืนยัน', 'กรุณาติ๊กถูกช่องรับรองข้อมูลด้านล่างก่อนยื่นคำขอ', 'warning');

  showLoading('กำลังตรวจสอบข้อมูลและส่งคำขอ กพช.1-3...');
  try {
    const elig = await callApi('checkEligibility', { student_id: sid });
    const targetTerm = formatTermText(term);
    const dup = (elig.approvals12 || []).find(x =>
      formatTermText(x.term) === targetTerm && ['WAIT_TEACHER_12', 'APPROVED_12'].includes(x.status_12)
    );
    if (dup) {
      hideLoading();
      return safeAlert(
        dup.status_12 === 'APPROVED_12' ? 'มีสิทธิ์ กพช.1-3 ในภาคเรียนนี้แล้ว ✅' : 'ยื่นคำขอในภาคเรียนนี้ไว้แล้ว ⏳',
        `รหัสนักศึกษา <b>${esc(sid)}</b> มีคำขอในภาคเรียน <b>${esc(targetTerm)}</b> แล้ว (รหัส: <b>${esc(dup.req12_id)}</b>)<br>หากข้อมูลผิดสามารถกดแก้ไขได้ที่แท็บ <b>"🔍 เช็กสถานะ / แก้ไข"</b>`,
        'info'
      );
    }

    const res = await callApi('submitPreApproval12', {
      payload: {
        student_id: sid, student_name: sname, level: lvl, teacher_id: tid, group_name: grp,
        term, category: cat, role_note: roleNote, activity_name: actName,
        plan_start_date: startDate, plan_end_date: endDate, location: loc,
        p3_rationale: document.getElementById('p3_rationale').value.trim(),
        p3_objectives: document.getElementById('p3_objectives').value.trim(),
        p3_target: document.getElementById('p3_target').value.trim(),
        p3_steps: document.getElementById('p3_steps').value.trim(),
        p3_budget: document.getElementById('p3_budget').value.trim(),
        p3_material: document.getElementById('p3_material').value.trim(),
        p3_labor: document.getElementById('p3_labor').value.trim(),
        p3_expected: document.getElementById('p3_expected').value.trim(),
        eval_scores: evalScores, self_eval_ok: evalOk
      }
    });
    hideLoading();
    safeAlert('ยื่นขอ กพช.1-3 สำเร็จ! 📋', `รหัสคำขอของคุณคือ <b class="text-primary">${esc(res.req12_id)}</b><br>กรุณารอครูประจำกลุ่มอนุมัติก่อนส่งรายงานผล กพช.4`, 'success');
    ['p12_student_id','p12_student_name','p12_level','p12_teacher_id','p12_group_name','p12_category','p12_role_note','p12_activity_name','p12_start_date','p12_end_date','p3_rationale','p3_objectives','p3_target','p3_steps','p3_expected'].forEach(id => {
      document.getElementById(id).value = '';
    });
    for (let i = 1; i <= 10; i++) document.querySelectorAll(`input[name="eval_q${i}"]`).forEach(el => el.checked = false);
    document.getElementById('p12_self_eval_ok').checked = false;
  } catch (err) {
    hideLoading();
    safeAlert('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

function resetSubmitLock(btnText) {
  const btn = document.getElementById('btnSubmitKPCH');
  btn.disabled = true;
  btn.innerHTML = `<i class="bi bi-lock me-2"></i>${btnText || 'กรุณาตรวจสอบสิทธิ์ กพช.1-3 ด้านบนก่อนส่งผลงาน'}`;
  document.getElementById('ref12SelectWrap').classList.add('d-none');
  document.getElementById('f_ref_12_id').innerHTML = '';
  currentEligibleList12 = [];
}

async function checkEligibilityUI() {
  const sid = document.getElementById('f_student_id').value.trim();
  const banner = document.getElementById('eligibilityBanner');
  if (!sid) return safeAlert('แจ้งเตือน', 'กรุณากรอกรหัสนักศึกษาก่อนกดตรวจสอบสิทธิ์', 'warning');

  showLoading('กำลังตรวจสอบสิทธิ์ กพช.1-3...');
  try {
    const res = await callApi('checkEligibility', { student_id: sid });
    hideLoading();
    banner.classList.remove('d-none');

    if (!res.hasAny12) {
      resetSubmitLock('ไม่สามารถส่งได้ (ยังไม่ได้ขออนุมัติ กพช.1-3)');
      banner.innerHTML = `
        <div class="alert alert-danger mb-0 rounded-3 small">
          <div class="fw-bold mb-1">❌ ยังไม่พบคำขออนุมัติทำ กพช. (กพช.1-3) ของรหัส ${esc(sid)}</div>
          <button type="button" class="btn btn-danger btn-sm rounded-pill mt-1 fw-bold" onclick="goToPre12WithId('${esc(sid)}')">📋 ไปหน้าขออนุมัติ กพช.1-3 ทันที</button>
        </div>`;
      return;
    }

    const approvedList = (res.approvals12 || []).filter(x => x.status_12 === 'APPROVED_12');
    if (approvedList.length === 0) {
      const latest = res.approvals12[0];
      const st = STEP12_LABELS[latest.status_12] || { text: latest.status_12 };
      resetSubmitLock('รอครูอนุมัติ กพช.1-3 ก่อนจึงจะส่งผลงานได้');
      banner.innerHTML = `
        <div class="alert alert-warning mb-0 rounded-3 small">
          <div class="fw-bold mb-1">⏳ ยังไม่สามารถส่งผลงานได้ (สถานะล่าสุด: ${st.text})</div>
          <div>รหัสคำขอ: <b>${esc(latest.req12_id)}</b> | โครงการ: ${esc(latest.activity_name)}</div>
          ${latest.status_12 === 'REJECTED_12' ? `<div class="text-danger mt-1"><b>เหตุผลที่ตีกลับ:</b> ${esc(latest.reject_reason_12)} — ไปแก้ไขได้ที่แท็บ <b>"🔍 เช็กสถานะ / แก้ไข"</b></div>` : ''}
        </div>`;
      return;
    }

    currentEligibleList12 = approvedList;
    banner.innerHTML = `<div class="alert alert-success mb-0 rounded-3 small"><b>✅ ผ่านการตรวจสอบสิทธิ์ กพช.1-3 แล้ว!</b></div>`;
    document.getElementById('ref12SelectWrap').classList.remove('d-none');
    document.getElementById('f_ref_12_id').innerHTML = approvedList.map(x => `<option value="${esc(x.req12_id)}">${esc(x.req12_id)} (ภาคเรียน ${esc(formatTermText(x.term))}) - ${esc(x.activity_name)}</option>`).join('');
    onSelectApproved12();

    const btn = document.getElementById('btnSubmitKPCH');
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-send-heart me-2"></i>ส่งรายงานผล กพช.4`;
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
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
  const files = Array.from(input.files || []);
  const box = document.getElementById('imagePreviewBox');
  box.innerHTML = '';
  compressedImages = [];
  if (files.length < 2 || files.length > 3) {
    safeAlert('แจ้งเตือน', 'กรุณาเลือกรูปภาพจำนวน 2 ถึง 3 ภาพเท่านั้น', 'warning');
    input.value = '';
    return;
  }
  showLoading('กำลังย่อขนาดรูปภาพ...');
  try {
    for (const file of files) {
      const b64 = await compressImageFile(file, 1024, 0.75);
      compressedImages.push({ name: file.name, mimeType: 'image/jpeg', base64Data: b64.split(',')[1] });
      box.innerHTML += `<img src="${b64}" class="thumb-preview">`;
    }
  } catch (err) {
    safeAlert('ผิดพลาด', 'ไม่สามารถอ่านไฟล์รูปภาพได้', 'error');
  } finally { hideLoading(); }
}

async function handleEditImageSelection(input) {
  const files = Array.from(input.files || []);
  const box = document.getElementById('se_imagePreviewBox');
  box.innerHTML = '';
  editCompressedImages = [];
  if (files.length === 0) return;
  if (files.length < 2 || files.length > 3) {
    safeAlert('แจ้งเตือน', 'หากต้องการเปลี่ยนรูป กรุณาเลือก 2 ถึง 3 ภาพ', 'warning');
    input.value = '';
    return;
  }
  showLoading('กำลังย่อขนาดรูปภาพใหม่...');
  try {
    for (const file of files) {
      const b64 = await compressImageFile(file, 1024, 0.75);
      editCompressedImages.push({ name: file.name, mimeType: 'image/jpeg', base64Data: b64.split(',')[1] });
      box.innerHTML += `<img src="${b64}" class="thumb-preview">`;
    }
  } finally { hideLoading(); }
}

function compressImageFile(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleStudentSubmit() {
  const sid = document.getElementById('f_student_id').value.trim();
  const ref12Id = document.getElementById('f_ref_12_id').value;
  const sname = document.getElementById('f_student_name').value.trim();
  const lvl = document.getElementById('f_level').value;
  const cat = document.getElementById('f_category').value;
  const tid = document.getElementById('f_teacher_id').value;
  const grp = document.getElementById('f_group_name').value.trim();
  const hrs = document.getElementById('f_hours').value;
  const actName = document.getElementById('f_activity_name').value.trim();
  const startDate = document.getElementById('f_activity_date').value;
  const endDate = document.getElementById('f_activity_end_date').value;
  const loc = document.getElementById('f_location').value.trim();
  const detail = document.getElementById('f_activity_detail').value.trim();

  if (!ref12Id) return safeAlert('ยังไม่ได้รับอนุมัติ กพช.1-3', 'กรุณาตรวจสอบสิทธิ์ กพช.1-3 ก่อนส่งผลงาน', 'warning');
  if (!sid || !sname || !lvl || !cat || !tid || !grp || !hrs || !actName || !startDate || !endDate || !detail) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * และเลือกประเภท กพช. ให้ครบ', 'warning');
  }
  if (endDate < startDate) return safeAlert('วันที่ไม่ถูกต้อง', 'วันสิ้นสุดโครงการต้องไม่น้อยกว่าวันที่เริ่มโครงการ', 'warning');
  if (compressedImages.length < 2 || compressedImages.length > 3) return safeAlert('รูปภาพไม่ครบ', 'กรุณาแนบรูปภาพกิจกรรม 2 - 3 ภาพ', 'warning');

  showLoading('กำลังอัปโหลดรูปภาพและบันทึกข้อมูล...');
  try {
    const res = await callApi('submitKPCH', {
      payload: {
        ref_12_id: ref12Id, student_id: sid, student_name: sname, level: lvl,
        category: cat, teacher_id: tid, group_name: grp, hours: hrs,
        activity_name: actName, activity_date: startDate, activity_end_date: endDate,
        location: loc,
        k4_plan: document.getElementById('f_k4_plan').value.trim(),
        activity_detail: detail,
        k4_learning: document.getElementById('f_k4_learning').value.trim(),
        k4_problem: document.getElementById('f_k4_problem').value.trim(),
        k4_apply: document.getElementById('f_k4_apply').value.trim(),
        images: compressedImages
      }
    });
    hideLoading();
    safeAlert('ส่งรายงานผล กพช.4 สำเร็จ! 🎉', `รหัสคำขอของคุณคือ <b class="text-primary">${esc(res.req_id)}</b><br>เรื่องถูกส่งไปยังครูประจำกลุ่มเรียบร้อยแล้ว`, 'success');
    ['f_student_id','f_student_name','f_level','f_category','f_teacher_id','f_group_name','f_hours','f_activity_name','f_activity_date','f_activity_end_date','f_location','f_k4_plan','f_activity_detail','f_k4_learning','f_k4_apply','f_images'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('imagePreviewBox').innerHTML = '';
    document.getElementById('eligibilityBanner').classList.add('d-none');
    compressedImages = [];
    resetSubmitLock();
  } catch (err) {
    hideLoading();
    safeAlert('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==================== เช็กสถานะ & ปุ่มปรับปรุงแก้ไขของนักศึกษา ====================
let lastStatus12List = [];
let lastStatusSubList = [];

async function searchMyStatus() {
  const sid = document.getElementById('searchStudentId').value.trim();
  if (!sid) return safeAlert('แจ้งเตือน', 'กรุณากรอกรหัสนักศึกษา', 'warning');
  showLoading('กำลังค้นหาข้อมูล...');
  try {
    const res = await callApi('checkStatus', { student_id: sid });
    hideLoading();
    const list12 = res.approvals12 || [];
    const listSubs = res.submissions || [];
    lastStatus12List = list12;
    lastStatusSubList = listSubs;
    const area = document.getElementById('statusResultArea');

    if (list12.length === 0 && listSubs.length === 0) {
      area.innerHTML = `
        <div class="alert alert-warning rounded-4 text-center">
          <div class="fw-bold mb-1">❌ ยังไม่พบประวัติการขออนุมัติทำ กพช. ของรหัสนักศึกษา ${esc(sid)}</div>
          <button type="button" class="btn btn-primary btn-sm rounded-pill fw-bold mt-2" onclick="goToPre12WithId('${esc(sid)}')">📋 ไปยื่นขอ กพช.1-3 ตอนนี้</button>
        </div>`;
      return;
    }

    let html = '<h6 class="fw-bold text-primary mb-2">📋 1. สถานะคำขออนุมัติ / เสนอโครงการ (กพช.1-3)</h6>';
    if (list12.length === 0) {
      html += '<div class="alert alert-secondary small rounded-3">ยังไม่มีรายการขอ กพช.1-3</div>';
    } else {
      html += list12.map(r => {
        const st = STEP12_LABELS[r.status_12] || { text: r.status_12, cls: 'bg-secondary' };
        const canEdit = ['WAIT_TEACHER_12', 'REJECTED_12'].includes(r.status_12);
        return `
          <div class="mobile-item-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <span class="badge bg-light text-primary border me-1">${esc(r.req12_id)}</span>
                ${r.category ? `<span class="badge bg-info bg-opacity-10 text-dark border me-1">${esc(r.category)}</span>` : ''}
                <strong>${esc(r.activity_name)}</strong>
                <div class="small text-muted mt-1">
                  ผู้ขอ: ${esc(r.student_name)} | ครู: ${esc(r.teacher_name)} | ภาคเรียน: ${esc(formatTermText(r.term))}<br>
                  แผนวันที่: ${formatShortThaiDate(r.plan_start_date)} ถึง ${formatShortThaiDate(r.plan_end_date)}
                </div>
              </div>
              <span class="badge step-badge ${st.cls}">${st.text}</span>
            </div>
            ${r.status_12 === 'APPROVED_12' ? `<div class="small text-success fw-semibold mt-2">✅ อนุมัติเมื่อ: ${esc(r.approved_at_12)}</div>` : ''}
            ${r.reject_reason_12 ? `<div class="alert alert-danger mt-2 mb-1 py-2 small rounded-3"><b>เหตุผลที่ครูตีกลับ:</b> ${esc(r.reject_reason_12)}</div>` : ''}
            ${canEdit ? `
              <div class="mt-2">
                <button type="button" class="btn btn-warning btn-sm rounded-pill fw-bold" onclick="openStudentEditModal('12', '${esc(r.req12_id)}')">
                  <i class="bi bi-pencil-square me-1"></i>ปรับปรุง / แก้ไขข้อมูล
                </button>
              </div>` : ''}
          </div>`;
      }).join('');
    }

    html += '<h6 class="fw-bold text-primary mt-4 mb-2">📸 2. สถานะรายงานผลสำเร็จ กพช.4 (หลังทำเสร็จ)</h6>';
    if (listSubs.length === 0) {
      html += '<div class="alert alert-light border small rounded-3">ยังไม่มีการส่งบันทึกผลงานพร้อมรูปภาพ</div>';
    } else {
      html += listSubs.map(r => {
        const st = STEP_LABELS[r.current_step] || { text: r.current_step, cls: 'bg-secondary' };
        const canEdit = ['WAIT_TEACHER', 'REJECTED'].includes(r.current_step);
        const steps = [
          { label: 'ครูตรวจ', done: !!r.teacher_approved_at },
          { label: 'กก.1', done: !!r.comm1_approved_at },
          { label: 'กก.2', done: !!r.comm2_approved_at },
          { label: 'กก.3', done: !!r.comm3_approved_at },
          { label: 'ผอ.', done: !!r.director_approved_at },
          { label: 'ครูส่งทะเบียน', done: !!r.teacher_presented_at || r.current_step === 'APPROVED_FOR_REGISTRAR' || r.current_step === 'COMPLETED' },
          { label: 'นายทะเบียน', done: r.current_step === 'COMPLETED' }
        ];
        const progHtml = steps.map(s => `
          <div class="prog-step ${s.done ? 'done' : (r.current_step === 'REJECTED' ? 'rejected' : '')}">
            <div>${s.done ? '✅' : (r.current_step === 'REJECTED' ? '❌' : '⏳')}</div>
            <div>${s.label}</div>
          </div>`).join('');

        return `
          <div class="mobile-item-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <span class="badge bg-light text-primary border me-1">${esc(r.req_id)}</span>
                ${r.category ? `<span class="badge bg-info bg-opacity-10 text-dark border me-1">${esc(r.category)}</span>` : ''}
                <strong>${esc(r.activity_name)}</strong>
                <div class="small text-muted mt-1">
                  ผู้ส่ง: ${esc(r.student_name)} | ครู: ${esc(r.teacher_name)} | จำนวน: <b>${esc(r.hours)} ชม.</b><br>
                  ช่วงวันที่: ${formatShortThaiDate(r.activity_date)} ถึง ${formatShortThaiDate(r.activity_end_date)}
                </div>
              </div>
              <span class="badge step-badge ${st.cls}">${st.text}</span>
            </div>
            <div class="cute-progress-bar">${progHtml}</div>
            ${r.reject_reason ? `<div class="alert alert-danger mt-2 mb-1 py-2 small rounded-3"><b>เหตุผลที่ครูตีกลับ:</b> ${esc(r.reject_reason)}</div>` : ''}
            ${canEdit ? `
              <div class="mt-2">
                <button type="button" class="btn btn-warning btn-sm rounded-pill fw-bold" onclick="openStudentEditModal('sub', '${esc(r.req_id)}')">
                  <i class="bi bi-pencil-square me-1"></i>ปรับปรุง / แก้ไขข้อมูล
                </button>
              </div>` : ''}
          </div>`;
      }).join('');
    }
    area.innerHTML = html;
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

function openStudentEditModal(itemType, id) {
  const item = itemType === '12'
    ? lastStatus12List.find(x => x.req12_id === id)
    : lastStatusSubList.find(x => x.req_id === id);
  if (!item) return;

  editCompressedImages = [];
  document.getElementById('se_images').value = '';
  document.getElementById('se_imagePreviewBox').innerHTML = '';

  document.getElementById('se_type').value = itemType;
  document.getElementById('se_id').value = id;
  document.getElementById('se_req_id').innerText = id;
  document.getElementById('se_student_name').value = item.student_name || '';
  document.getElementById('se_level').value = item.level || '';
  document.getElementById('se_teacher_id').value = item.teacher_id || '';
  document.getElementById('se_group_name').value = item.group_name || '';
  document.getElementById('se_category').value = item.category || '';
  document.getElementById('se_activity_name').value = item.activity_name || '';
  document.getElementById('se_location').value = item.location || '';

  const rejEl = document.getElementById('se_reject_alert');
  const rejMsg = itemType === '12' ? item.reject_reason_12 : item.reject_reason;
  if (rejMsg) {
    rejEl.innerHTML = `<b>เหตุผลที่ถูกตีกลับ:</b> ${esc(rejMsg)}`;
    rejEl.classList.remove('d-none');
  } else {
    rejEl.classList.add('d-none');
  }

  const is12 = itemType === '12';
  document.getElementById('se_hours_wrap').classList.toggle('d-none', is12);
  document.getElementById('se_p3_wrap').classList.toggle('d-none', !is12);
  document.getElementById('se_k4_wrap').classList.toggle('d-none', is12);

  if (is12) {
    document.getElementById('se_start_date').value = toInputDate(item.plan_start_date);
    document.getElementById('se_end_date').value = toInputDate(item.plan_end_date);
    document.getElementById('se_role_note').value = item.role_note || '';
    document.getElementById('se_p3_rationale').value = item.p3_rationale || '';
    document.getElementById('se_p3_objectives').value = item.p3_objectives || '';
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
  const itemType = document.getElementById('se_type').value;
  const sid = document.getElementById('searchStudentId').value.trim();
  const payload = {
    item_type: itemType,
    id: document.getElementById('se_id').value,
    student_id: sid,
    student_name: document.getElementById('se_student_name').value.trim(),
    level: document.getElementById('se_level').value,
    teacher_id: document.getElementById('se_teacher_id').value,
    group_name: document.getElementById('se_group_name').value.trim(),
    category: document.getElementById('se_category').value,
    activity_name: document.getElementById('se_activity_name').value.trim(),
    start_date: document.getElementById('se_start_date').value,
    end_date: document.getElementById('se_end_date').value,
    location: document.getElementById('se_location').value.trim()
  };
  if (itemType === '12') {
    payload.role_note = document.getElementById('se_role_note').value;
    payload.p3_rationale = document.getElementById('se_p3_rationale').value.trim();
    payload.p3_objectives = document.getElementById('se_p3_objectives').value.trim();
  } else {
    payload.hours = document.getElementById('se_hours').value;
    payload.k4_plan = document.getElementById('se_k4_plan').value.trim();
    payload.activity_detail = document.getElementById('se_detail').value.trim();
    payload.k4_learning = document.getElementById('se_k4_learning').value.trim();
    payload.k4_problem = document.getElementById('se_k4_problem').value.trim();
    payload.k4_apply = document.getElementById('se_k4_apply').value.trim();
    if (editCompressedImages.length >= 2) payload.images = editCompressedImages;
  }

  showLoading('กำลังบันทึกการแก้ไขข้อมูล...');
  try {
    await callApi('studentUpdateRecord', { payload });
    hideLoading();
    closeModalById('studentEditModal');
    safeAlert('แก้ไขเรียบร้อย ✅', 'ข้อมูลถูกปรับปรุงและส่งกลับให้ครูตรวจสอบใหม่อีกครั้งแล้ว', 'success');
    await searchMyStatus();
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== ล็อคอิน / หลังบ้าน ====================
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
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (!u || !p) return safeAlert('แจ้งเตือน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning');
  showLoading('กำลังเข้าสู่ระบบ...');
  try {
    const res = await callApi('login', { username: u, password: p });
    hideLoading();
    authToken = res.token;
    currentUser = res.user;
    sessionStorage.setItem('kpch_token', authToken);
    closeModalById('loginModal');
    document.getElementById('loginPass').value = '';
    teacherTabMode = 'sub';
    presentSubMode = 'WAIT';
    resetDashboardTabViews();
    await loadDashboard();
  } catch (err) {
    hideLoading();
    safeAlert('เข้าสู่ระบบไม่สำเร็จ', err.message, 'error');
  }
}

function handleLogout() {
  if (authToken) callApi('logout', { token: authToken }).catch(() => {});
  authToken = null; currentUser = null;
  dashItems = []; dash12Items = [];
  sessionStorage.removeItem('kpch_token');
  document.getElementById('dashboardSection').classList.add('d-none');
  document.getElementById('publicSection').classList.remove('d-none');
  resetDashboardTabViews();
  renderNavbar();
  loadPublicData();
}

function updateSubmissionsBarsVisibility() {
  const isTeacher = currentUser.role === 'TEACHER';
  const isReg = currentUser.role === 'REGISTRAR';
  const isAdmin = currentUser.role === 'ADMIN';
  const isTeacherPresentTab = isTeacher && teacherTabMode === 'present';
  const canBatchApproveSub = ['COMM_1', 'COMM_2', 'COMM_3', 'DIRECTOR'].includes(currentUser.role) || (isTeacher && teacherTabMode === 'sub');
  const canBatchMemo = ['DIRECTOR', 'REGISTRAR', 'ADMIN'].includes(currentUser.role);
  const canCheckSub = canBatchApproveSub || canBatchMemo || isTeacherPresentTab || isTeacher || isAdmin;

  document.getElementById('subFilterRow').classList.remove('d-none');
  document.getElementById('filterStatusBtnsWrap').classList.toggle('d-none', isTeacherPresentTab);
  document.getElementById('presentSubFilterWrap').classList.toggle('d-none', !isTeacherPresentTab);
  document.getElementById('dashTeacherFilterWrap').classList.toggle('d-none', !(isReg || isAdmin));
  document.getElementById('teacherPresentBar').classList.toggle('d-none', !(isTeacherPresentTab || isAdmin));
  document.getElementById('btnConfirmPresentReg')?.classList.toggle('d-none', isTeacherPresentTab && presentSubMode === 'SENT');
  document.getElementById('batchApproveSubBar').classList.toggle('d-none', !canBatchApproveSub);
  document.getElementById('batchMemoBar').classList.toggle('d-none', !canBatchMemo);
  document.getElementById('registrar
  document.getElementById('registrarTools').classList.toggle('d-none', !isReg);
  document.getElementById('adminDeleteSubBar')?.classList.toggle('d-none', !isAdmin);
  document.getElementById('thCheckbox').classList.toggle('d-none', !canCheckSub);
  document.getElementById('mobileCheckAllSubWrap').classList.toggle('d-none', !canCheckSub);
}

function renderAdminAnnPdfBox(ann) {
  const box = document.getElementById('annCurrentPdfBox');
  const fileInput = document.getElementById('ann_pdf_file');
  if (fileInput) fileInput.value = '';
  if (!box) return;
  if (ann && ann.pdf_url) {
    box.classList.remove('d-none');
    box.innerHTML = `
      <div class="alert alert-light border d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 mb-0 rounded-3 small">
        <div>
          <i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i>
          <b>ไฟล์แนบปัจจุบัน:</b>
          <a href="${esc(ann.pdf_url)}" target="_blank" class="fw-semibold">${esc(ann.pdf_name || 'เอกสารประกาศ.pdf')}</a>
        </div>
        <div class="form-check mb-0">
          <input class="form-check-input" type="checkbox" id="ann_remove_pdf">
          <label class="form-check-label text-danger fw-semibold" for="ann_remove_pdf">ลบไฟล์ PDF นี้ออก</label>
        </div>
      </div>
    `;
  } else {
    box.classList.add('d-none');
    box.innerHTML = '';
  }
}

async function loadDashboard(silentOnExpire = false) {
  showLoading('กำลังโหลดข้อมูลหลังบ้าน...');
  try {
    const res = await callApi('getDashboard', { token: authToken });
    hideLoading();
    currentUser = res.user;
    dashItems = res.items || [];
    dash12Items = res.items12 || [];
    if (res.categories) {
      kpchCategories = res.categories;
      populateCategorySelects();
    }
    registrarName = res.registrar_name || '';
    adminUsers = res.users || [];
    adminLogs = res.logs || [];
    adminTrashSubs = res.trash_submissions || [];
    adminTrash12 = res.trash_approvals12 || [];

    document.getElementById('publicSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    renderNavbar();

    document.getElementById('dashTitle').innerText = `หลังบ้าน: ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
    document.getElementById('dashSubtitle').innerText = `สวัสดีคุณ ${currentUser.full_name} (${currentUser.group_name || '-'})`;

    const isAdmin = currentUser.role === 'ADMIN';
    const isTeacher = currentUser.role === 'TEACHER';

    document.getElementById('adminNavTabs').classList.toggle('d-none', !isAdmin);
    document.getElementById('teacherNavTabs').classList.toggle('d-none', !isTeacher);
    document.getElementById('adminDelete12Bar')?.classList.toggle('d-none', !isAdmin);

    if (isTeacher) {
      const waitSub = dashItems.filter(x => x.current_step === 'WAIT_TEACHER').length;
      const waitPresent = dashItems.filter(x => x.current_step === 'WAIT_TEACHER_PRESENT').length;
      const sentPresent = dashItems.filter(x => ['APPROVED_FOR_REGISTRAR', 'COMPLETED'].includes(x.current_step)).length;
      const wait12 = dash12Items.filter(x => x.status_12 === 'WAIT_TEACHER_12').length;

      const bSub = document.getElementById('badgeWaitSub');
      const bPres = document.getElementById('badgeWaitPresent');
      const b12 = document.getElementById('badgeWait12');
      bSub.innerText = waitSub; bSub.classList.toggle('d-none', waitSub === 0);
      bPres.innerText = waitPresent; bPres.classList.toggle('d-none', waitPresent === 0);
      b12.innerText = wait12; b12.classList.toggle('d-none', wait12 === 0);

      const bWaitBtn = document.getElementById('btnPresentWait');
      const bSentBtn = document.getElementById('btnPresentSent');
      if (bWaitBtn) bWaitBtn.innerText = `⏳ รอนำส่ง (${waitPresent})`;
      if (bSentBtn) bSentBtn.innerText = `✅ ส่งแล้ว / ประวัติ (${sentPresent})`;
    }

    const badgeTrash = document.getElementById('badgeTrashCount');
    if (isAdmin) {
      renderAdminCategories();
      renderAdminUsers();
      renderAdminLogs();
      renderAdminTrash();
      const totalTrash = adminTrashSubs.length + adminTrash12.length;
      if (badgeTrash) {
        badgeTrash.innerText = totalTrash;
        badgeTrash.classList.toggle('d-none', totalTrash === 0);
      }
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

    if (!isAdmin && !isTeacher) {
      teacherTabMode = 'sub';
      resetDashboardTabViews();
    }

    populateTermDropdown(document.getElementById('dashTermFilter'), dashItems, getItemTerm);
    populateTermDropdown(document.getElementById('dash12TermFilter'), dash12Items, x => formatTermText(x.term));
    populateDashTeacherFilter();

    updateSubmissionsBarsVisibility();
    renderDashboardList();
    if (isTeacher || isAdmin) render12List();
  } catch (err) {
    hideLoading();
    if (silentOnExpire) {
      authToken = null;
      sessionStorage.removeItem('kpch_token');
      renderNavbar();
    } else {
      safeAlert('ผิดพลาด', err.message, 'error');
    }
  }
}

function switchTeacherTab(tab, btn) {
  teacherTabMode = tab;
  document.querySelectorAll('#teacherNavTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const showSubs = (tab === 'sub' || tab === 'present');
  document.getElementById('dashSubmissionsView').classList.toggle('d-none', !showSubs);
  document.getElementById('dash12View').classList.toggle('d-none', tab !== 'req12');
  if (showSubs) {
    updateSubmissionsBarsVisibility();
    renderDashboardList();
  }
}

function setPresentSubMode(mode, btn) {
  presentSubMode = mode;
  document.querySelectorAll('#presentSubBtns button').forEach(b => {
    b.classList.remove('btn-primary', 'active');
    b.classList.add('btn-outline-secondary');
  });
  btn.classList.remove('btn-outline-secondary');
  btn.classList.add('btn-primary', 'active');
  updateSubmissionsBarsVisibility();
  renderDashboardList();
}

function setFilterMode(mode, btn) {
  filterMode = mode;
  document.querySelectorAll('#filterStatusBtns button').forEach(b => {
    b.classList.remove('btn-primary', 'active');
    b.classList.add('btn-outline-secondary');
  });
  btn.classList.remove('btn-outline-secondary');
  btn.classList.add('btn-primary', 'active');
  renderDashboardList();
}

function setFilter12Mode(mode, btn) {
  filter12Mode = mode;
  document.querySelectorAll('#filter12Btns button').forEach(b => {
    b.classList.remove('btn-primary', 'active');
    b.classList.add('btn-outline-secondary');
  });
  btn.classList.remove('btn-outline-secondary');
  btn.classList.add('btn-primary', 'active');
  render12List();
}

function isMyPendingItem(item) {
  const r = currentUser.role;
  if (r === 'TEACHER') return item.current_step === 'WAIT_TEACHER';
  if (r === 'COMM_1') return item.current_step === 'WAIT_COMM_1';
  if (r === 'COMM_2') return item.current_step === 'WAIT_COMM_2';
  if (r === 'COMM_3') return item.current_step === 'WAIT_COMM_3';
  if (r === 'DIRECTOR') return item.current_step === 'WAIT_DIRECTOR';
  if (r === 'REGISTRAR') return item.current_step === 'APPROVED_FOR_REGISTRAR';
  return true;
}

// ==================== ตาราง กพช.1-3 + พิมพ์เอกสาร 56 (กพช.3) ====================
function toggleAll12Checks(master) {
  document.querySelectorAll('.chk-12').forEach(cb => cb.checked = master.checked);
}

function render12List() {
  const kw = document.getElementById('dash12SearchInput').value.toLowerCase().trim();
  const termVal = document.getElementById('dash12TermFilter')?.value || 'ALL';
  const catVal = document.getElementById('dash12CategoryFilter')?.value || 'ALL';
  const isAdmin = currentUser.role === 'ADMIN';

  const filtered = dash12Items.filter(item => {
    if (filter12Mode === 'PENDING' && item.status_12 !== 'WAIT_TEACHER_12') return false;
    if (!matchesTermFilter(formatTermText(item.term), termVal)) return false;
    if (catVal !== 'ALL' && String(item.category || '').trim() !== catVal) return false;
    if (kw) {
      const text = `${item.req12_id} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.category || ''} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });
  currentFiltered12 = filtered;

  const tbody = document.getElementById('dash12TableBody');
  const mobileBox = document.getElementById('dash12MobileCards');
  const masterCb = document.getElementById('checkAll12Box');
  if (masterCb) masterCb.checked = false;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">ไม่มีคำขอ กพช.1-3 ในหมวดหมู่นี้</td></tr>`;
    mobileBox.innerHTML = `<div class="text-center py-4 text-muted">ไม่มีคำขอ กพช.1-3 ในหมวดหมู่นี้</div>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
    const canAct = item.status_12 === 'WAIT_TEACHER_12';
    return `
      <tr>
        <td><input type="checkbox" class="chk-12" value="${esc(item.req12_id)}"></td>
        <td>
          <div class="fw-bold text-primary">${esc(item.req12_id)}</div>
          <div class="small text-muted">${esc(item.created_at)}</div>
        </td>
        <td>
          <div class="fw-semibold">${esc(item.student_name)}</div>
          <div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div>
        </td>
        <td class="small">
          ${item.category ? `<span class="badge bg-info bg-opacity-10 text-dark border mb-1">${esc(item.category)}</span><br>` : ''}
          ภาค: ${esc(formatTermText(item.term))}
        </td>
        <td>
          <div class="fw-semibold">${esc(item.activity_name)}</div>
          <div class="small text-muted">${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)} ${item.role_note ? `| <b>${esc(item.role_note)}</b>` : ''}</div>
        </td>
        <td><span class="badge step-badge ${st.cls}">${st.text}</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" onclick="open12DetailModal('${esc(item.req12_id)}')">
            <i class="bi bi-eye"></i> ${canAct ? 'ตรวจ/อนุมัติ' : 'ดูแผน'}
          </button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill ms-1" onclick="printForm12('${esc(item.req12_id)}')">
            <i class="bi bi-printer"></i> กพช.1-2
          </button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="confirmDelete12(['${esc(item.req12_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  mobileBox.innerHTML = filtered.map(item => {
    const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
    const canAct = item.status_12 === 'WAIT_TEACHER_12';
    return `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div><input type="checkbox" class="chk-12 me-2" value="${esc(item.req12_id)}"><span class="fw-bold text-primary">${esc(item.req12_id)}</span></div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-2">
          <b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)}) | <b>ประเภท:</b> ${esc(item.category || '-')}<br>
          <b>แผนวันที่:</b> ${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)}
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm rounded-pill flex-fill fw-bold" onclick="open12DetailModal('${esc(item.req12_id)}')">
            <i class="bi bi-eye me-1"></i>${canAct ? 'ตรวจ / อนุมัติ' : 'ดูรายละเอียด'}
          </button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="printForm12('${esc(item.req12_id)}')">
            <i class="bi bi-printer"></i> กพช.1-2
          </button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDelete12(['${esc(item.req12_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function confirmBatchApprove12() {
  const ids = Array.from(new Set(Array.from(document.querySelectorAll('.chk-12:checked')).map(cb => cb.value)));
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการ กพช.1-3 อย่างน้อย 1 รายการครับ', 'warning');
  Swal.fire({
    title: `อนุมัติ กพช.1-3 จำนวน ${ids.length} รายการ?`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยันอนุมัติทั้งหมด', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading(`กำลังอนุมัติ กพช.1-3 (${ids.length} รายการ)...`);
      try {
        const r = await callApi('batchApprove12', { token: authToken, req12_ids: ids });
        hideLoading();
        safeAlert('สำเร็จ 🎉', `อนุมัติเรียบร้อยแล้ว ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchReject12() {
  const ids = Array.from(new Set(Array.from(document.querySelectorAll('.chk-12:checked')).map(cb => cb.value)));
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการตีกลับอย่างน้อย 1 รายการ', 'warning');
  Swal.fire({
    title: `ตีกลับ กพช.1-3 (${ids.length} รายการ)`,
    input: 'textarea',
    inputLabel: 'ระบุเหตุผลในการตีกลับให้นักศึกษาทราบ',
    inputPlaceholder: 'เช่น ชื่อกิจกรรมไม่ชัดเจน, ประเภท กพช. ไม่ถูกต้อง...',
    showCancelButton: true, confirmButtonText: 'ยืนยันตีกลับ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444',
    inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลในการตีกลับด้วยครับ'; }
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังบันทึกการตีกลับ...');
      try {
        const r = await callApi('batchReject12', { token: authToken, req12_ids: ids, reason: res.value.trim() });
        hideLoading();
        safeAlert('ตีกลับเรียบร้อย', `ส่งคืนให้นักศึกษาแก้ไข ${r.count} รายการแล้ว`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchDelete12() {
  const ids = Array.from(new Set(Array.from(document.querySelectorAll('.chk-12:checked')).map(cb => cb.value)));
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการย้ายลงถังขยะ', 'warning');
  confirmDelete12(ids);
}

function confirmDelete12(req12Ids) {
  if (!currentUser || currentUser.role !== 'ADMIN') return safeAlert('ไม่มีสิทธิ์', 'เฉพาะ Admin เท่านั้น', 'error');
  Swal.fire({
    title: `ย้ายข้อมูล กพช.1-3 (${req12Ids.length} รายการ) ลงถังขยะ?`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: '🗑️ ย้ายลงถังขยะ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังย้ายลงถังขยะ...');
      try {
        const r = await callApi('deleteApprovals12', { token: authToken, req12_ids: req12Ids });
        hideLoading(); closeModalById('detailModal');
        safeAlert('เรียบร้อย 🗑️', `ย้ายลงถังขยะแล้ว ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function open12DetailModal(req12Id) {
  const item = dash12Items.find(x => x.req12_id === req12Id);
  if (!item) return;

  let scores = [];
  try { scores = JSON.parse(item.eval_scores || '[]'); } catch (e) {}
  const scorePreview = EVAL_QUESTIONS_12.map((q, i) => `
    <tr><td class="text-center">${i + 1}</td><td>${q}</td><td class="text-center fw-bold text-primary">${esc(scores[i] || '-')}</td></tr>
  `).join('');

  document.getElementById('mdReqId').innerText = item.req12_id;
  const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
  document.getElementById('detailModalBody').innerHTML = `
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span class="badge step-badge ${st.cls}">${st.text}</span>
      <span class="text-muted small">ยื่นขอเมื่อ: ${esc(item.created_at)}</span>
    </div>
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
    <h6 class="fw-bold">ชื่อกิจกรรม / โครงการ (กพช.3):</h6>
    <p>${esc(item.activity_name)}</p>
    ${item.p3_rationale ? `<div class="small border p-2 rounded-3 bg-white mb-2"><b>หลักการและเหตุผล:</b> ${esc(item.p3_rationale)}</div>` : ''}
    ${item.p3_objectives ? `<div class="small border p-2 rounded-3 bg-white mb-2" style="white-space:pre-line;"><b>วัตถุประสงค์:</b>\n${esc(item.p3_objectives)}</div>` : ''}
    <h6 class="fw-bold mt-3">ผลประเมินตนเอง (กพช. 2) ทั้ง 10 ข้อ:</h6>
    <div class="table-responsive mb-2">
      <table class="table table-bordered table-sm small mb-0">
        <thead class="table-light"><tr><th style="width:40px;">ที่</th><th>รายการ</th><th style="width:85px;" class="text-center">ระดับ</th></tr></thead>
        <tbody>${scorePreview}</tbody>
      </table>
    </div>
    ${item.approved_at_12 ? `<div class="small text-success fw-bold">✅ อนุมัติเมื่อ: ${esc(item.approved_at_12)}</div>` : ''}
    ${item.reject_reason_12 ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(item.reject_reason_12)}</div>` : ''}
  `;

  const canAct = item.status_12 === 'WAIT_TEACHER_12' && ['TEACHER', 'ADMIN'].includes(currentUser.role);
  const isAdmin = currentUser.role === 'ADMIN';
  document.getElementById('detailModalFooter').innerHTML = `
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="printForm12('${esc(item.req12_id)}')">
        <i class="bi bi-printer me-1"></i>พิมพ์ กพช.1 และ กพช.2
      </button>
      ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDelete12(['${esc(item.req12_id)}'])"><i class="bi bi-trash me-1"></i>ย้ายลงถังขยะ</button>` : ''}
    </div>
    <div class="d-flex flex-wrap gap-2">
      ${canAct ? `
        <button type="button" class="btn btn-danger rounded-pill px-3 fw-bold" onclick="submitDecision12('${esc(item.req12_id)}', 'REJECT')">
          <i class="bi bi-x-circle me-1"></i>ตีกลับ (ระบุเหตุผล)
        </button>
        <button type="button" class="btn btn-success rounded-pill px-3 fw-bold" onclick="submitDecision12('${esc(item.req12_id)}', 'APPROVE')">
          <i class="bi bi-check-circle me-1"></i>อนุมัติให้ทำกิจกรรม
        </button>
      ` : ''}
      <button type="button" class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">ปิด</button>
    </div>
  `;
  openModalById('detailModal');
}

function submitDecision12(req12Id, decision) {
  // ปิด Bootstrap Modal ก่อน เพื่อไม่ให้แย่ง Focus ช่องพิมพ์เหตุผลของ SweetAlert2
  closeModalById('detailModal');
  setTimeout(() => {
    if (decision === 'APPROVE') {
      Swal.fire({
        title: 'อนุมัติคำขอ กพช.1-3?',
        text: `อนุญาตให้นักศึกษาดำเนินกิจกรรมตามคำขอ ${req12Id} ใช่หรือไม่`,
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'ยืนยันอนุมัติ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
      }).then(res => { if (res.isConfirmed) executeApproval12(req12Id, 'APPROVE', ''); });
    } else {
      Swal.fire({
        title: 'ระบุเหตุผลในการตีกลับ กพช.1-3',
        input: 'textarea',
        inputPlaceholder: 'เช่น ชื่อกิจกรรมไม่ชัดเจน / เลือกประเภท กพช. ผิด กรุณาปรับแก้ไข...',
        showCancelButton: true, confirmButtonText: 'ส่งตีกลับ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444',
        inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; }
      }).then(res => { if (res.isConfirmed) executeApproval12(req12Id, 'REJECT', res.value); });
    }
  }, 220);
}

async function executeApproval12(req12Id, decision, reason) {
  showLoading('กำลังบันทึกผล กพช.1-3...');
  try {
    await callApi('processApproval12', { token: authToken, req12_id: req12Id, decision, reason });
    hideLoading();
    safeAlert('สำเร็จ', 'บันทึกผลการพิจารณา กพช.1-3 เรียบร้อยแล้ว', 'success');
    await loadDashboard();
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

// ==================== จัดชุด & พิมพ์เอกสาร 56 (กพช. 3) 1 ชุด = 1 ไฟล์เอกสาร ====================
let _doc56Items = [];
function openDoc56PrintModal() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.chk-12:checked')).map(cb => cb.value)));
  _doc56Items = checkedIds.length > 0
    ? currentFiltered12.filter(x => checkedIds.includes(x.req12_id))
    : currentFiltered12;

  if (_doc56Items.length === 0) {
    return safeAlert('ไม่พบรายชื่อ', 'กรุณาเลือกประเภท กพช. หรือติ๊กเลือกรายชื่อนักศึกษาอย่างน้อย 1 คนก่อนสั่งพิมพ์', 'warning');
  }
  const first = _doc56Items[0];
  document.getElementById('d56_count').innerText = _doc56Items.length;
  document.getElementById('d56_project_name').value = first.activity_name || '';
  document.getElementById('d56_hours').value = first.hours || 25;
  document.getElementById('d56_rationale').value = first.p3_rationale ||
    'กิจกรรมพัฒนาคุณภาพชีวิต (กพช.) เป็นกิจกรรมที่เป็นองค์ประกอบสำคัญส่วนหนึ่งในโครงสร้างที่กำหนดไว้ในหลักเกณฑ์ และวิธีการจัดการศึกษานอกระบบระดับการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 บันทึกความดี มุ่งเน้นให้เกิดการพัฒนาตนเอง กิจกรรมพัฒนาคุณภาพชีวิต บันทึกความดี จะส่งผลต่อการพัฒนาตนเอง ครอบครัว ชุมชน สังคมและประเทศชาติ เพื่อให้ดำรงอยู่ในสังคมอย่างมีความสุข';
  document.getElementById('d56_objectives').value = first.p3_objectives ||
    '3.1 เพื่อเป็นการเปลี่ยนแปลงในการพัฒนาตนเอง ให้มีระเบียบ วินัย และการเสียสละ\n3.2 เพื่อส่งเสริมให้เป็นผู้มีน้ำใจ เสียสละ ในการพัฒนาตนเอง ครอบครัว ชุมชน สังคมและประเทศชาติ';
  document.getElementById('d56_target').value = first.p3_target ||
    'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย';
  document.getElementById('d56_steps').value = first.p3_steps ||
    '5.1 วางแผนการจัดกิจกรรม\n5.2 ปรึกษาอาจารย์ที่ปรึกษา\n5.3 เข้าร่วมโครงการ\n5.4 เสนอโครงการการจัดกิจกรรมฯ ต่อสถานศึกษาเพื่อให้คณะกรรมการพิจารณาอนุมัติโครงการ\n5.5 ดำเนินจัดกิจกรรมตามแผนที่กำหนด สรุปผลและรายงานผลการดำเนินงาน\n5.6 สรุปผลและรายงานผลการดำเนินงาน และขออนุมัติชั่วโมง กพช.';
  document.getElementById('d56_location').value = first.location || 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง จังหวัดปทุมธานี';
  document.getElementById('d56_start_date').value = toInputDate(first.plan_start_date);
  document.getElementById('d56_end_date').value = toInputDate(first.plan_end_date);
  document.getElementById('d56_budget').value = first.p3_budget || '-';
  document.getElementById('d56_material').value = first.p3_material || 'หนังสือ';
  document.getElementById('d56_labor').value = first.p3_labor || 'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง';
  document.getElementById('d56_expected').value = first.p3_expected ||
    'นักศึกษา ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง ได้รับการพัฒนาตนเอง ในด้านการคิด การกระทำ และการฝึกบันทึก เพื่อเป็นการพัฒนาตนเอง ในการดำเนินชีวิต ให้มีความรู้ ความเข้าใจ รู้จักคิดวิเคราะห์อย่างเป็นระบบ สามารถนำความรู้และประสบการณ์ที่ได้รับมาประยุกต์ใช้ในชีวิตประจำวัน';
  document.getElementById('d56_advisor').value = first.teacher_name || (currentUser?.full_name || '');
  document.getElementById('d56_comm1').value = COMM_1_NAME;
  document.getElementById('d56_comm2').value = COMM_2_NAME;
  document.getElementById('d56_comm3').value = COMM_3_NAME;
  document.getElementById('d56_director').value = DIRECTOR_NAME;
  openModalById('doc56Modal');
}

function executePrintDoc56() {
  const items = _doc56Items;
  const projName = document.getElementById('d56_project_name').value.trim();
  const hours = document.getElementById('d56_hours').value || '25';
  const rationale = document.getElementById('d56_rationale').value;
  const objectives = document.getElementById('d56_objectives').value;
  const target = document.getElementById('d56_target').value;
  const steps = document.getElementById('d56_steps').value;
  const loc = document.getElementById('d56_location').value;
  const sDate = formatThaiDateWithLabel(document.getElementById('d56_start_date').value);
  const eDate = formatThaiDateWithLabel(document.getElementById('d56_end_date').value);
  const budget = document.getElementById('d56_budget').value;
  const material = document.getElementById('d56_material').value;
  const labor = document.getElementById('d56_labor').value;
  const expected = document.getElementById('d56_expected').value;
  const advisor = document.getElementById('d56_advisor').value;
  const tOpinion = document.getElementById('d56_teacher_opinion').value;
  const comm1 = document.getElementById('d56_comm1').value;
  const comm2 = document.getElementById('d56_comm2').value;
  const comm3 = document.getElementById('d56_comm3').value;
  const director = document.getElementById('d56_director').value;

  const isGroup = items.length > 1;
  const leader = items.find(i => (i.role_note || '').includes('ประธาน')) || items[0];
  const rowsHtml = items.map((s, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${esc(s.student_name)}</td>
      <td style="text-align:center;">${esc(s.student_id)}</td>
      <td style="text-align:center;">${esc(s.role_note || (idx === 0 && isGroup ? 'ประธาน' : ''))}</td>
      <td style="text-align:center;">${esc(s.level || '')}</td>
    </tr>
  `).join('');

  document.getElementById('printOnlyContainer').innerHTML = `
  <div style="line-height:1.4; font-size:15.5pt;">
    <!-- หน้า 1: หัวข้อ 1-9 -->
    <div class="memo-page">
      <div class="kpch-box-tag">กพช. 3</div>
      <div class="doc-title-center">แบบเสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับผู้เรียน)</div>
      <div style="margin-top:8px;"><b>ส่วนที่ 1 สำหรับผู้เรียน</b></div>
      <div>เสนอต่อสถานศึกษา (ชื่อสถานศึกษา) &nbsp;&nbsp;&nbsp; <b>${SCHOOL_NAME}</b></div>
      <div><b>1. ชื่อโครงการ</b> &nbsp;&nbsp; ${esc(projName)}</div>
      <div><b>2. หลักการและเหตุผล</b><div class="doc-section-indent">${esc(rationale).replace(/\n/g,'<br>')}</div></div>
      <div><b>3. วัตถุประสงค์</b><div class="doc-section-indent">${esc(objectives).replace(/\n/g,'<br>')}</div></div>
      <div><b>4. เป้าหมาย</b><div class="doc-section-indent">${esc(target).replace(/\n/g,'<br>')}</div></div>
      <div><b>5. ขั้นตอน/แผนการปฏิบัติโครงการ</b><div class="doc-section-indent">${esc(steps).replace(/\n/g,'<br>')}</div></div>
      <div><b>6. สถานที่ดำเนินการ</b><div class="doc-section-indent">${esc(loc)}</div></div>
      <div><b>7. ระยะเวลาการดำเนินโครงการ</b><div class="doc-section-indent">ระหว่างวันที่ ${sDate} ถึงวันที่ ${eDate}</div></div>
      <div><b>8. ปัจจัยในการดำเนินโครงการ</b>
        <div class="doc-section-indent">8.1 เงิน ${esc(budget)}<br>8.2 วัสดุ ${esc(material)}<br>8.3 แรงงาน ${esc(labor)}</div>
      </div>
      <div><b>9. ผลที่คาดว่าจะได้รับ</b><div class="doc-section-indent">${esc(expected).replace(/\n/g,'<br>')}</div></div>
    </div>

    <!-- หน้า 2: หัวข้อ 10-12 + ตารางรายชื่อ + ส่วนที่ 2 ความเห็นครู -->
    <div class="memo-page">
      <div style="text-align:center; margin-bottom:6px;">-2-</div>
      <div><b>10. ผู้รับผิดชอบโครงการ</b> ชื่อ ${isGroup ? '........................................' : esc(leader.student_name)} รหัส ${isGroup ? '........................' : esc(leader.student_id)} (กรณีเสนอเป็นรายบุคคล)</div>
      <div><b>11. ผู้รับผิดชอบโครงการ</b> จำนวน ${isGroup ? items.length : '............'} คน ได้แก่ ${isGroup ? esc(leader.student_name) + ' และคณะ' : '........................................'} (กรณีเสนอเป็นกลุ่ม)</div>
      <div style="text-align:center; font-weight:bold; margin-top:8px;">รายชื่อผู้เข้าร่วมทำ${esc(projName)}</div>
      <table class="doc-table">
        <thead><tr><th style="width:45px;">ที่</th><th>ชื่อ - สกุล</th><th style="width:130px;">รหัสนักศึกษา</th><th style="width:110px;">หมายเหตุ</th><th style="width:110px;">ระดับ</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="margin-top:10px;"><b>12. ที่ปรึกษาโครงการ</b><br>&nbsp;&nbsp;&nbsp;&nbsp;1. ${esc(advisor)}</div>
      <div class="sig-center" style="margin-left:38%;">
        ลงชื่อ..................................................ผู้เสนอ/ประธานโครงการ<br>
        (${esc(leader.student_name)})
      </div>
      <div style="font-size:14pt !important; margin-top:8px;"><b>หมายเหตุ</b> ผู้เสนอ/ประธานโครงการ คัดเลือกจากนักศึกษาที่เข้าร่วมโครงการ หากทำโครงการคนเดียว ก็ถือว่าเป็นผู้เสนอและประธาน ด้วย</div>
      <div style="margin-top:10px;">
        <b>ส่วนที่ 2 สำหรับสถานศึกษา</b><br>
        ความเห็นครูผู้รับผิดชอบกลุ่มนักศึกษาที่จัดทำกิจกรรม กพช.<br>
        <div class="doc-section-indent">${esc(tOpinion)}</div>
      </div>
      <div class="sig-center" style="margin-left:35%;">
        ลงชื่อ..................................................ครูผู้รับผิดชอบกลุ่มนักศึกษาที่ทำกิจกรรม กพช.<br>
        (${esc(advisor)})
      </div>
    </div>

    <!-- หน้า 3: คณะกรรมการ 3 ท่าน + นายทะเบียน + ผอ. -->
    <div>
      <div><b>ความเห็นชอบของคณะกรรมการพิจารณาและประเมินผลการปฏิบัติโครงการ กพช.</b></div>
      <div style="margin-left:1.5cm; margin-top:4px;">
        &#9744; เห็นควรดำเนินการได้ โดยประมาณค่าหน่วยกิจกรรมโครงการนี้ จำนวน ......<b>${esc(hours)}</b>...... ชั่วโมง<br>
        &#9744; ควรปรับปรุงแก้ไข<br>
        1. ..............................................................................................................<br>
        2. ..............................................................................................................<br>
        3. ..............................................................................................................
      </div>
      <div class="sig-center" style="margin-top:18px;">
        ลงชื่อ.................................................. ประธานคณะกรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการ<br>(${esc(comm1)})<br><br>
        ลงชื่อ.................................................. กรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการ<br>(${esc(comm2)})<br><br>
        ลงชื่อ.................................................. กรรมการการพิจารณาและประเมินผลการปฏิบัติโครงการและเลขานุการ<br>(${esc(comm3)})
      </div>
      <div class="sig-row-2" style="margin-top:26px;">
        <div class="sig-col" style="text-align:left;">
          <b>เสนอหัวหน้าสถานศึกษา</b><br>
          ........................................................................<br>
          ........................................................................<br><br>
          <div style="text-align:center;">ลงชื่อ..........................................นายทะเบียน<br>(${registrarName ? esc(registrarName) : '..........................................'})</div>
        </div>
        <div class="sig-col" style="text-align:left;">
          <b>ความเห็นของหัวหน้าสถานศึกษา</b><br>
          ........................................................................<br>
          ........................................................................<br><br>
          <div style="text-align:center;">ลงชื่อ..........................................<br>(${esc(director)})<br>ผู้อำนวยการ สกร.ระดับอำเภอคลองหลวง<br>วันที่............เดือน....................พ.ศ. .........</div>
        </div>
      </div>
    </div>
  </div>`;

  closeModalById('doc56Modal');
  setTimeout(() => window.print(), 350);
}

// ==================== พิมพ์ กพช.1 และ กพช.2 (คงรูปแบบเดิม) ====================
function printForm12(req12Id) {
  const item = dash12Items.find(x => x.req12_id === req12Id);
  if (!item) return;
  const nameParts = (item.student_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '-';
  const termObj = parseTermParts(item.term);
  const dotsStr = '.'.repeat(120);
  const dotSpan = `<span style="flex:1; min-width:12px; overflow:hidden; white-space:nowrap; letter-spacing:1px;">${dotsStr}</span>`;
  const makeDotFlex = (val, extraStyle = '') => {
    const clean = esc(val);
    return !clean
      ? `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>`
      : `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`;
  };
  const makeDotInline = (val, extraStyle = '') => {
    const clean = esc(val);
    return !clean
      ? `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>`
      : `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`;
  };
  const blankDateLine = '<span style="letter-spacing:1px;">........./................../..............</span>';
  const regNameDisplay = registrarName ? esc(registrarName) : '<span style="letter-spacing:1px;">....................................</span>';
  const fillRowStyle = 'display:flex; align-items:center; gap:10px; margin-bottom:14px; line-height:1.3;';
  const sigRowStyle = 'display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; line-height:1.3;';
  let scores = [];
  try { scores = JSON.parse(item.eval_scores || '[]'); } catch (e) {}
  const evalRowsHtml = EVAL_QUESTIONS_12.map((q, i) => {
    const val = scores[i] || '';
    return `<tr><td style="text-align:center;">${i + 1}</td><td>${q}</td><td style="text-align:center; font-weight:bold;">${val === 'มาก' ? '✓' : ''}</td><td style="text-align:center; font-weight:bold;">${val === 'ปานกลาง' ? '✓' : ''}</td><td style="text-align:center; font-weight:bold;">${val === 'น้อย' ? '✓' : ''}</td><td></td></tr>`;
  }).join('');
  const passChecked = item.status_12 !== 'REJECTED_12';
  const rejectChecked = item.status_12 === 'REJECTED_12';

  document.getElementById('printOnlyContainer').innerHTML = `
    <div class="memo-page" style="padding: 10px 16px; line-height: 1.9; font-size: 16pt;">
      <div style="text-align:right; font-weight:bold; margin-bottom:14px;">กพช. 1</div>
      <div style="text-align:center; font-weight:bold; font-size:18pt; margin-bottom:12px;">แบบลงทะเบียนกิจกรรมพัฒนาคุณภาพชีวิต (รายบุคคล)</div>
      <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:8px;"><b>สถานศึกษา</b>${makeDotInline(SCHOOL_NAME, 'width:390px;')}</div>
      <div style="display:flex; justify-content:center; align-items:center; gap:6px; margin-bottom:28px;"><b>ภาคเรียนที่</b>${makeDotInline(termObj.no, 'width:65px;')}<span>/</span>${makeDotInline(termObj.year, 'width:95px;')}</div>
      <div style="${fillRowStyle}"><span>ชื่อ</span>${makeDotFlex(firstName)}<span>สกุล</span>${makeDotFlex(lastName)}<span>รหัสประจำตัวนักศึกษา</span>${makeDotFlex(item.student_id, 'flex:0.9;')}</div>
      <div style="${fillRowStyle}"><span>ระดับ</span>${makeDotFlex(item.level)}<span>กลุ่ม/กศน.ตำบล</span>${makeDotFlex(item.group_name || '-', 'flex:1.3;')}</div>
      <div style="${fillRowStyle} margin-bottom:44px;"><span>ครูรับผิดชอบ</span>${makeDotFlex(item.teacher_name)}</div>
      <div style="text-align:center; margin-bottom:68px;"><span style="${sigRowStyle}">ลงชื่อ${makeDotInline('', 'width:200px; margin:0 6px;')}นักศึกษา</span><br>( ${esc(item.student_name)} )<br>${blankDateLine}</div>
      <div style="display:flex; justify-content:space-between; text-align:center; margin-top:40px;">
        <div style="width:48%;"><span style="${sigRowStyle}">ลงชื่อ${makeDotInline('', 'width:140px; margin:0 6px;')}ผู้รับลงทะเบียน</span><br>( ${esc(item.teacher_name)} )<br>${blankDateLine}</div>
        <div style="width:48%;"><span style="${sigRowStyle}">ลงชื่อ${makeDotInline('', 'width:140px; margin:0 6px;')}นายทะเบียน</span><br>( ${regNameDisplay} )<br>${blankDateLine}</div>
      </div>
    </div>
    <div style="padding: 4px 8px; line-height: 1.4;">
      <div style="text-align:right; font-weight:bold; font-size:15pt;">กพช. 2</div>
      <div style="text-align:center; font-weight:bold; font-size:17pt; margin-bottom:6px;">แบบประเมินตนเองกิจกรรมพัฒนาคุณภาพชีวิต</div>
      <div style="font-weight:bold; font-size:15pt; margin-bottom:4px;">ส่วนที่ 1 สำหรับผู้เรียน</div>
      <div style="font-size:14.5pt; margin-bottom:10px; line-height:1.3;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;"><span>ชื่อสถานศึกษา</span>${makeDotFlex(SCHOOL_NAME)}</div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;"><span>ชื่อ-สกุล</span>${makeDotFlex(item.student_name)}<span>รหัสประจำตัวนักศึกษา</span>${makeDotFlex(item.student_id, 'flex:0.8;')}</div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;"><span>ระดับการศึกษา</span>${makeDotFlex(item.level)}<span>ศูนย์การเรียน</span>${makeDotFlex(item.group_name || '-')}</div>
        <div style="display:flex; align-items:center; gap:10px;"><span>ครูผู้รับผิดชอบ</span>${makeDotFlex(item.teacher_name)}</div>
      </div>
      <table class="batch-table" style="font-size:13.5pt !important;">
        <thead><tr><th rowspan="2" style="width:5%;">ที่</th><th rowspan="2" style="width:57%;">รายการ</th><th colspan="3" style="width:26%;">ระดับความรู้ความเข้าใจ</th><th rowspan="2" style="width:12%;">หมายเหตุ</th></tr><tr><th>มาก</th><th>ปานกลาง</th><th>น้อย</th></tr></thead>
        <tbody>${evalRowsHtml}</tbody>
      </table>
      <div style="text-align:center; margin:12px 0; font-size:15pt;"><span style="${sigRowStyle}">ลงชื่อ${makeDotInline('', 'width:190px; margin:0 6px;')}ผู้เรียน</span><br>( ${esc(item.student_name)} )</div>
      <div style="display:flex; align-items:center; gap:10px; font-size:15pt; margin-bottom:14px;">
        <b>ส่วนที่ 2 สำหรับสถานศึกษา</b>
        <span><span style="display:inline-block; width:16px; height:16px; border:1px solid #000; text-align:center; line-height:15px;">${passChecked ? '✓' : '&nbsp;'}</span> ผ่าน</span>
        <span><span style="display:inline-block; width:16px; height:16px; border:1px solid #000; text-align:center; line-height:15px;">${rejectChecked ? '✓' : '&nbsp;'}</span> เพิ่มเติมในเรื่อง</span>
        ${makeDotFlex(rejectChecked ? item.reject_reason_12 : '', 'min-width:150px;')}
      </div>
      <div style="text-align:center; font-size:15pt;"><span style="${sigRowStyle}">ลงชื่อ${makeDotInline('', 'width:190px; margin:0 6px;')}ครูผู้รับผิดชอบ</span><br>( ${esc(item.teacher_name)} )</div>
    </div>
  `;
  setTimeout(() => window.print(), 400);
}

// ==================== แบบประเมินผลการปฏิบัติโครงการ (กพช. 5) ====================
function buildKPCH5Html(item, isLastInPrint, imagesBase64 = []) {
  const comm1Name = (adminUsers.find(u => u.role === 'COMM_1' && u.status === 'ACTIVE') || {}).full_name || COMM_1_NAME;
  const comm2Name = (adminUsers.find(u => u.role === 'COMM_2' && u.status === 'ACTIVE') || {}).full_name || COMM_2_NAME;
  const comm3Name = (adminUsers.find(u => u.role === 'COMM_3' && u.status === 'ACTIVE') || {}).full_name || COMM_3_NAME;
  const dotsStr = '.'.repeat(140);
  const dotSpan = `<span style="flex:1; min-width:12px; overflow:hidden; white-space:nowrap; letter-spacing:1px;">${dotsStr}</span>`;
  const makeDotFlex = (val, extraStyle = '') => {
    const clean = esc(val);
    return !clean
      ? `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>`
      : `<span style="display:flex; flex:1; min-width:0; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`;
  };
  const makeDotInline = (val, extraStyle = '') => {
    const clean = esc(val);
    return !clean
      ? `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}</span>`
      : `<span style="display:inline-flex; align-items:center; overflow:hidden; ${extraStyle}">${dotSpan}<span style="white-space:nowrap; padding:0 6px;">${clean}</span>${dotSpan}</span>`;
  };
  const chkBox = '<span style="display:inline-block; width:13px; height:13px; border:1px solid #000; vertical-align:-2px; margin-right:5px;"></span>';
  const row5 = 'display:flex; align-items:center; gap:8px; margin-bottom:4px; line-height:1.3;';
  const phaseRow = (label) => `
    <div style="${row5} margin-top:4px;"><span style="white-space:nowrap;">${label}</span><span>เมื่อวันที่</span>${makeDotInline('', 'width:50px;')}<span>เดือน</span>${makeDotInline('', 'width:95px;')}<span>พ.ศ.</span>${makeDotFlex('', 'min-width:50px;')}</div>
    <div style="padding-left:22px; margin-bottom:4px;">${chkBox}ผ่าน &nbsp;&nbsp;&nbsp;&nbsp; ${chkBox}ปรับปรุง</div>
    <div style="${row5} padding-left:22px; margin-bottom:6px;"><span>เหตุผลประกอบการประเมิน</span>${makeDotFlex('')}</div>
  `;
  const startTxt = item.activity_date ? formatShortThaiDate(item.activity_date) : '';
  const endTxt = item.activity_end_date ? formatShortThaiDate(item.activity_end_date) : '';
  const photoPage = imagesBase64.length > 0 ? `
    <div class="${isLastInPrint ? '' : 'memo-page'}">
      <div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:8px;">ภาพถ่ายประกอบการดำเนินกิจกรรม (${esc(item.student_name)})</div>
      <div style="text-align:center; font-size:14pt; margin-bottom:10px;">โครงการ: ${esc(item.activity_name)} | รหัสอ้างอิง: ${esc(item.req_id)}</div>
      <div class="photo-grid">${imagesBase64.map(b => `<img src="${b}">`).join('')}</div>
    </div>` : '';

  return `
    <div class="memo-page" style="font-size:14.5pt; line-height:1.35;">
      <div style="text-align:right; font-size:14.5pt; margin-bottom:2px;">กพช. 5</div>
      <div style="text-align:center; font-weight:bold; font-size:16.5pt; margin-bottom:10px;">แบบประเมินผลการปฏิบัติโครงการกิจกรรมพัฒนาคุณภาพชีวิต</div>
      <div style="${row5}"><span>ชื่อโครงการที่ประเมิน</span>${makeDotFlex(item.activity_name)}</div>
      <div style="${row5}"><span>ชื่อประธานโครงการ</span>${makeDotFlex(item.student_name)}</div>
      <div style="${row5}"><span>ระยะเวลาที่เริ่มปฏิบัติตามโครงการ</span>${makeDotFlex(startTxt)}<span>วันสิ้นสุดโครงการ</span>${makeDotFlex(endTxt)}</div>
      <div style="${row5} margin-bottom:10px;"><span>สถานที่ปฏิบัติโครงการ</span>${makeDotFlex(item.location || '')}</div>
      <div style="font-weight:bold; margin-bottom:4px;">บันทึกความก้าวหน้าโครงการ</div>
      ${phaseRow('ระยะที่ 1 ก่อนดำเนินโครงการ')}
      ${phaseRow('ระยะที่ 2 ระหว่างดำเนินโครงการ')}
      ${phaseRow('ระยะที่ 3 เสร็จสิ้นโครงการ')}
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
      <div style="display:flex; margin-bottom:10px;">${makeDotFlex('')}</div>
      <div style="display:flex; margin-bottom:10px;">${makeDotFlex('')}</div>
      <div style="display:flex; margin-bottom:26px;">${makeDotFlex('')}</div>
      <div style="display:flex; justify-content:center; gap:6px; margin-bottom:24px;"><span>ประเมินผลเมื่อวันที่</span>${makeDotInline('', 'width:65px;')}<span>เดือน</span>${makeDotInline('', 'width:110px;')}<span>พ.ศ.</span>${makeDotInline('', 'width:70px;')}</div>
      <div style="margin-left:20%; margin-bottom:20px;"><div style="display:flex;"><span>ลงชื่อ</span><div style="text-align:center; margin:0 6px;">${makeDotInline('', 'width:190px;')}<br>(${esc(comm1Name)})</div><span>ประธานคณะกรรมการ</span></div></div>
      <div style="margin-left:20%; margin-bottom:20px;"><div style="display:flex;"><span>ลงชื่อ</span><div style="text-align:center; margin:0 6px;">${makeDotInline('', 'width:190px;')}<br>(${esc(comm2Name)})</div><span>คณะกรรมการ</span></div></div>
      <div style="margin-left:20%; margin-bottom:28px;"><div style="display:flex;"><span>ลงชื่อ</span><div style="text-align:center; margin:0 6px;">${makeDotInline('', 'width:190px;')}<br>(${esc(comm3Name)})</div><span>คณะกรรมการและเลขานุการ</span></div></div>
      <div style="font-weight:bold; margin-bottom:4px;">ผลการพิจารณาอนุมัติของผู้บริหารสถานศึกษา</div>
      <div style="display:flex; gap:6px; margin-bottom:10px;"><span>- อนุมัติ จำนวน</span>${makeDotInline('', 'width:100px;')}<span>ชั่วโมง.</span></div>
      <div style="display:flex; margin-bottom:10px;">${makeDotFlex('')}</div>
      <div style="display:flex; margin-bottom:28px;">${makeDotFlex('')}</div>
      <div style="text-align:center;">ลงชื่อ${makeDotInline('', 'width:190px; margin:0 6px;')}ผู้อนุมัติ<br>(${DIRECTOR_NAME})<br>ผู้อำนวยการ สกร.ระดับอำเภอคลองหลวง<br>อนุมัติผลเมื่อวันที่${makeDotInline('', 'width:65px;')}เดือน${makeDotInline('', 'width:110px;')}พ.ศ.${makeDotInline('', 'width:70px;')}</div>
    </div>
    ${photoPage}
  `;
}

// ==================== ตารางส่งผลงาน กพช.4 + พิมพ์เอกสาร 57 (บันทึกข้อความ -> กพช.4 -> กพช.5 -> กพช.6) ====================
function toggleAllChecks(master) {
  document.querySelectorAll('.reg-check').forEach(cb => cb.checked = master.checked);
}

function getFilteredDashItems() {
  const kw = (document.getElementById('dashSearchInput')?.value || '').toLowerCase().trim();
  const termVal = document.getElementById('dashTermFilter')?.value || 'ALL';
  const catVal = document.getElementById('dashCategoryFilter')?.value || 'ALL';
  const teacherVal = document.getElementById('dashTeacherFilter')?.value || 'ALL';
  const isTeacher = currentUser.role === 'TEACHER';
  const isPresentTab = isTeacher && teacherTabMode === 'present';
  const showTeacherFilter = ['REGISTRAR', 'ADMIN'].includes(currentUser.role);

  return dashItems.filter(item => {
    if (isPresentTab) {
      if (presentSubMode === 'SENT') {
        if (!['APPROVED_FOR_REGISTRAR', 'COMPLETED'].includes(item.current_step)) return false;
      } else {
        if (item.current_step !== 'WAIT_TEACHER_PRESENT') return false;
      }
    } else if (filterMode === 'PENDING' && !isMyPendingItem(item)) {
      return false;
    }
    if (!matchesTermFilter(getItemTerm(item), termVal)) return false;
    if (catVal !== 'ALL' && String(item.category || '').trim() !== catVal) return false;
    if (showTeacherFilter && teacherVal !== 'ALL' && String(item.teacher_name || '').trim() !== teacherVal) return false;
    if (kw) {
      const text = `${item.req_id} ${item.ref_12_id || ''} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.category || ''} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });
}

function renderDashboardList() {
  const isTeacher = currentUser.role === 'TEACHER';
  const isAdmin = currentUser.role === 'ADMIN';
  const isPresentTab = isTeacher && teacherTabMode === 'present';
  const canCheck = ['TEACHER', 'COMM_1', 'COMM_2', 'COMM_3', 'DIRECTOR', 'REGISTRAR', 'ADMIN'].includes(currentUser.role);

  const filtered = getFilteredDashItems();
  currentFilteredSubs = filtered;

  const tbody = document.getElementById('dashTableBody');
  const mobileBox = document.getElementById('dashMobileCards');
  const masterCb = document.getElementById('checkAllBox');
  if (masterCb) masterCb.checked = false;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">ไม่มีรายการในหมวดหมู่นี้</td></tr>`;
    mobileBox.innerHTML = `<div class="text-center py-4 text-muted">ไม่มีรายการในหมวดหมู่นี้</div>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
    const canAct = !isPresentTab && isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
    const termTxt = getItemTerm(item);
    return `
      <tr>
        ${canCheck ? `<td><input type="checkbox" class="reg-check" value="${esc(item.req_id)}"></td>` : ''}
        <td>
          <div class="fw-bold text-primary">${esc(item.req_id)}</div>
          <div class="small text-muted">${esc(item.created_at)} ${termTxt ? `<span class="badge bg-light text-dark border ms-1">ภาค ${esc(termTxt)}</span>` : ''}</div>
        </td>
        <td>
          <div class="fw-semibold">${esc(item.student_name)}</div>
          <div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div>
        </td>
        <td class="small">
          <div>${esc(item.teacher_name)}</div>
          ${item.category ? `<span class="badge bg-info bg-opacity-10 text-dark border">${esc(item.category)}</span>` : ''}
        </td>
        <td>
          <div class="fw-semibold">${esc(item.activity_name)}</div>
          <div class="small text-muted">${formatShortThaiDate(item.activity_date)} ถึง ${formatShortThaiDate(item.activity_end_date)} | <b>${esc(item.hours)} ชม.</b></div>
        </td>
        <td><span class="badge step-badge ${st.cls}">${st.text}</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" onclick="openDetailModal('${esc(item.req_id)}')">
            <i class="bi bi-eye"></i> ${canAct ? 'ตรวจ/อนุมัติ' : 'ดูข้อมูล'}
          </button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill ms-1" onclick="printProjectPDF('${esc(item.req_id)}')">
            <i class="bi bi-printer"></i> โครงการ
          </button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="confirmDeleteSubmissions(['${esc(item.req_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  mobileBox.innerHTML = filtered.map(item => {
    const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
    const canAct = !isPresentTab && isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
    return `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>${canCheck ? `<input type="checkbox" class="reg-check me-2" value="${esc(item.req_id)}">` : ''}<span class="fw-bold text-primary">${esc(item.req_id)}</span></div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-2">
          <b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)}) | <b>ประเภท:</b> ${esc(item.category || '-')}<br>
          <b>ชั่วโมง:</b> ${esc(item.hours)} ชม. | <b>วันที่:</b> ${formatShortThaiDate(item.activity_date)} ถึง ${formatShortThaiDate(item.activity_end_date)}
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm rounded-pill flex-fill fw-bold" onclick="openDetailModal('${esc(item.req_id)}')"><i class="bi bi-eye me-1"></i>${canAct ? 'ตรวจ / อนุมัติ' : 'ดูรายละเอียด'}</button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="printProjectPDF('${esc(item.req_id)}')"><i class="bi bi-printer"></i></button>
          ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDeleteSubmissions(['${esc(item.req_id)}'])"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function confirmBatchApproveSub() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && isMyPendingItem(it); });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่รอดำเนินการอย่างน้อย 1 รายการ', 'warning');
  Swal.fire({
    title: `อนุมัติและส่งต่อ ${validIds.length} รายการ?`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยันอนุมัติทั้งหมด', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading(`กำลังอนุมัติ (${validIds.length} รายการ)...`);
      try {
        const r = await callApi('batchApproveSubmissions', { token: authToken, req_ids: validIds });
        hideLoading(); safeAlert('สำเร็จ 🎉', `อนุมัติเรียบร้อยแล้ว ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchRejectSub() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && (isMyPendingItem(it) || currentUser.role === 'ADMIN'); });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการตีกลับอย่างน้อย 1 รายการ', 'warning');

  Swal.fire({
    title: `ตีกลับผลงาน (${validIds.length} รายการ)`,
    input: 'textarea',
    inputLabel: 'ระบุเหตุผลในการตีกลับให้นักศึกษาแก้ไข',
    inputPlaceholder: 'เช่น รูปภาพไม่ชัดเจน, ชั่วโมงไม่ถูกต้อง, เนื้อหากพช.4 ไม่ครบ...',
    showCancelButton: true, confirmButtonText: 'ยืนยันตีกลับ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444',
    inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; }
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังบันทึกการตีกลับ...');
      try {
        const r = await callApi('batchRejectSubmissions', { token: authToken, req_ids: validIds, reason: res.value.trim() });
        hideLoading(); safeAlert('ตีกลับเรียบร้อย', `ส่งคืนให้นักศึกษาแก้ไข ${r.count} รายการแล้ว`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmBatchDeleteSub() {
  const ids = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่ต้องการย้ายลงถังขยะ', 'warning');
  confirmDeleteSubmissions(ids);
}

function confirmDeleteSubmissions(reqIds) {
  if (!currentUser || currentUser.role !== 'ADMIN') return safeAlert('ไม่มีสิทธิ์', 'เฉพาะ Admin เท่านั้น', 'error');
  Swal.fire({
    title: `ย้ายผลงาน (${reqIds.length} รายการ) ลงถังขยะ?`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: '🗑️ ย้ายลงถังขยะ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังย้ายลงถังขยะ...');
      try {
        const r = await callApi('deleteSubmissions', { token: authToken, req_ids: reqIds });
        hideLoading(); closeModalById('detailModal');
        safeAlert('เรียบร้อย 🗑️', `ย้ายลงถังขยะแล้ว ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

// ==================== จัดชุด & พิมพ์เอกสาร 57 (บันทึกข้อความ -> กพช.4 -> กพช.5 -> กพช.6) ====================
let _doc57TargetIds = [];
function openDoc57ConfigAndPrint() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const items = checkedIds.length > 0
    ? currentFilteredSubs.filter(x => checkedIds.includes(x.req_id))
    : currentFilteredSubs;

  if (items.length === 0) {
    return safeAlert('ไม่พบรายการ', 'กรุณาเลือกประเภท กพช. หรือติ๊กเลือกรายการอย่างน้อย 1 รายการก่อนสั่งพิมพ์', 'warning');
  }
  _doc57TargetIds = items.map(x => x.req_id);
  const first = items[0];

  document.getElementById('d57_count').innerText = items.length;
  document.getElementById('d57_doc_no').value = 'ศธ 07058.02/';
  document.getElementById('d57_doc_date').value = formatThaiDate();
  document.getElementById('d57_project_name').value = first.activity_name || '';
  document.getElementById('d57_location').value = first.location || 'ห้องสมุดประชาชนอำเภอคลองหลวง จังหวัดปทุมธานี';
  document.getElementById('d57_pass_count').value = items.length;
  document.getElementById('d57_fail_count').value = 0;
  document.getElementById('d57_hours').value = first.hours || 25;
  document.getElementById('d57_teacher_name').value = first.teacher_name || (currentUser?.full_name || '');
  document.getElementById('d57_registrar').value = registrarName || '';
  document.getElementById('d57_director').value = DIRECTOR_NAME;
  openModalById('doc57Modal');
}

async function executePrintDoc57() {
  if (_doc57TargetIds.length === 0) return;
  closeModalById('doc57Modal');
  showLoading(`กำลังจัดชุดเอกสาร 57 (${_doc57TargetIds.length} รายการ)...`);
  try {
    const batchData = await callApi('getSubmissionsBatchForPrint', { token: authToken, req_ids: _doc57TargetIds });
    hideLoading();

    const items = batchData.map(b => b.item);
    const first = items[0];
    const docNo = document.getElementById('d57_doc_no').value.trim();
    const docDate = document.getElementById('d57_doc_date').value.trim();
    const projName = document.getElementById('d57_project_name').value.trim();
    const loc = document.getElementById('d57_location').value.trim();
    const passCount = document.getElementById('d57_pass_count').value;
    const failCount = document.getElementById('d57_fail_count').value;
    const hours = document.getElementById('d57_hours').value;
    const tName = document.getElementById('d57_teacher_name').value.trim();
    const tPos = document.getElementById('d57_teacher_pos').value.trim();
    const filler = document.getElementById('d57_filler').value.trim();
    const checker = document.getElementById('d57_checker').value.trim();
    const regName = document.getElementById('d57_registrar').value.trim();
    const director = document.getElementById('d57_director').value.trim();

    const sDate = formatThaiDateWithLabel(first.activity_date);
    const eDate = formatThaiDateWithLabel(first.activity_end_date);
    const isGroup = items.length > 1;

    // 1. บันทึกข้อความ
    const memoHtml = `
      <div class="memo-page">
        <div class="memo-header">
          <img src="${GARUDA_URL}" class="memo-garuda" onerror="this.style.display='none'">
          <div class="memo-title">บันทึกข้อความ</div>
        </div>
        <div class="memo-field"><b>ส่วนราชการ</b> &nbsp; ${SCHOOL_NAME} &nbsp;&nbsp;&nbsp; <b>โทร.</b> 02 524 0645</div>
        <div class="memo-field" style="display:flex; justify-content:space-between;">
          <span><b>ที่</b> &nbsp; ${esc(docNo)}</span>
          <span><b>วันที่</b> &nbsp; ${esc(docDate)} &nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
        <div class="memo-field"><b>เรื่อง</b> &nbsp; รายงานผลสำเร็จโครงการกิจกรรมพัฒนาคุณภาพชีวิตและขออนุมัติชั่วโมงกิจกรรม</div>
        <div class="memo-divider"></div>
        <div class="memo-field" style="margin-bottom:8px;"><b>เรียน</b> &nbsp; ผู้อำนวยการ${SCHOOL_NAME}</div>
        <div class="memo-indent">
          ตามที่นักศึกษา ${SCHOOL_NAME} ระดับประถมศึกษา มัธยมศึกษาตอนต้น และมัธยมศึกษาตอนปลาย จำนวน ${items.length} คน ได้เสนอโครงการกิจกรรมพัฒนาคุณภาพชีวิต โครงการ/กิจกรรม ${esc(projName)} ระหว่างวันที่ ${sDate} ถึงวันที่ ${eDate} สถานที่ปฏิบัติกิจกรรม ${esc(loc)} โดยได้รับอนุมัติชั่วโมงกิจกรรม จำนวน ${esc(hours)} ชั่วโมง นั้น
        </div>
        <div class="memo-indent">
          ในการนี้ การปฏิบัติกิจกรรมตามโครงการได้เสร็จสิ้นเรียบร้อยแล้ว มีนักศึกษาเข้าร่วมโครงการและปฏิบัติกิจกรรมดังกล่าวโดยผ่านกิจกรรมจำนวน ${esc(passCount)} คน และไม่ผ่านกิจกรรมจำนวน ${esc(failCount)} คน และข้าพเจ้าได้ตรวจสอบเอกสารแล้ว มีความครบถ้วนถูกต้อง ทั้งนี้ได้แนบภาพถ่ายและใบลงชื่อมาด้วยแล้ว
        </div>
        <div class="memo-indent">จึงเรียนมาเพื่อโปรดทราบ และอนุมัติชั่วโมงกิจกรรม</div>
        <div class="sig-center" style="margin-left:38%;">
          ลงชื่อ..................................................<br>
          (${esc(tName)})<br>
          ตำแหน่ง ${esc(tPos)}
        </div>
        <div style="margin-left:35%; margin-top:14px; line-height:1.4;">
          &#9744; ทราบ<br>&#9744; อนุมัติ<br>&#9744; มอบงานทะเบียนบันทึกผลลงในระบบ ชั่วโมงกิจกรรม
        </div>
        <div class="sig-center" style="margin-left:38%; margin-top:24px;">
          (${esc(director)})<br>ผู้อำนวยการ${SCHOOL_NAME}
        </div>
        <div style="margin-top:20px;">
          <b>สำหรับงานทะเบียน</b><br>
          &nbsp;&nbsp;&nbsp;&nbsp;บันทึกผลลงในระบบเมื่อวันที่........เดือน............พ.ศ. ............<br><br>
          <div style="margin-left:18%;">(..................................................)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;เจ้าหน้าที่งานทะเบียน</div>
        </div>
      </div>`;

    // 2. กพช. 4 (แบบรายงานผลสำเร็จ + ตารางลงชื่อกรณีกลุ่ม + หน้าคำรับรองที่ปรึกษา)
    const groupTable = isGroup ? `
      <div style="margin-top:6px; font-weight:bold;">รายชื่อผู้ปฏิบัติโครงการ (กรณีรายกลุ่ม)</div>
      <table class="doc-table">
        <thead><tr><th style="width:40px;">ที่</th><th>ชื่อ - สกุล</th><th style="width:125px;">รหัสประจำตัว</th><th style="width:90px;">ระดับ</th><th style="width:125px;">ลายมือชื่อ</th></tr></thead>
        <tbody>${items.map((x, i) => `<tr><td style="text-align:center;">${i+1}</td><td>${esc(x.student_name)}</td><td style="text-align:center;">${esc(x.student_id)}</td><td style="text-align:center;">${esc(x.level||'')}</td><td></td></tr>`).join('')}</tbody>
      </table>` : '';

    const k4Html = `
      <div class="memo-page">
        <div class="kpch-box-tag">กพช. 4</div>
        <div class="doc-title-center">แบบรายงานผลสำเร็จของโครงการกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับผู้เรียน)</div>
        <div style="margin-top:8px;"><b>1. ชื่อโครงการที่ปฏิบัติ</b> &nbsp; ${esc(projName)}</div>
        <div><b>2. ระยะเวลาที่ปฏิบัติโครงการ</b> ระหว่างวันที่ ${sDate} ถึงวันที่ ${eDate}<br>
          &nbsp;&nbsp;&nbsp;&nbsp;สถานที่ปฏิบัติกิจกรรม &nbsp; ${esc(loc)}</div>
        <div><b>3. ผู้ปฏิบัติโครงการ</b>
          <div class="doc-section-indent">
            3.1 กรณีรายบุคคล &nbsp; ชื่อ-สกุล ${isGroup ? '............................' : esc(first.student_name)} &nbsp; รหัสประจำตัว ${isGroup ? '....................' : esc(first.student_id)}<br>
            ระดับ ${isGroup ? '................' : esc(first.level||'')} &nbsp; กศน.ตำบล/กลุ่ม ${esc(first.group_name||'-')} &nbsp; ภาคเรียนที่ ${esc(first.term||'-')}<br>
            3.2 กรณีรายกลุ่ม ให้แนบรายชื่อ-สกุล พร้อมลายมือชื่อ รหัสประจำตัว
          </div>
        </div>
        ${groupTable}
        <div><b>4. ผลการปฏิบัติโครงการ ประกอบด้วย</b>
          <div class="doc-section-indent">
            <b>4.1 การคิด/การวางแผน</b><br>${esc(first.k4_plan || '-').replace(/\n/g,'<br>')}<br>
            <b>4.2 การดำเนินงาน/ขั้นตอนการดำเนินงาน</b><br>${esc(first.activity_detail || '-').replace(/\n/g,'<br>')}<br>
            <b>4.3 การเรียนรู้และประสบการณ์ที่ได้รับ</b><br>${esc(first.k4_learning || '-').replace(/\n/g,'<br>')}<br>
            <b>4.4 ปัญหาที่พบและการแก้ไข</b><br>${esc(first.k4_problem || 'ไม่พบปัญหาในการทำงาน')}<br>
            <b>4.5 การนำไปใช้ในการพัฒนาคุณภาพชีวิต</b><br>${esc(first.k4_apply || '-').replace(/\n/g,'<br>')}
          </div>
        </div>
        <div><b>5. การนำไปใช้ในการพัฒนาคุณภาพชีวิต</b><div class="doc-section-indent">${esc(first.k4_apply || '-').replace(/\n/g,'<br>')}</div></div>
        <div class="sig-center" style="margin-left:38%;">ลงชื่อ..................................................ผู้ดำเนินงาน/ประธานโครงการ<br>(${esc(first.student_name)})</div>
      </div>
      <div class="memo-page">
        <div style="margin-top:20px;"><b>ขอรับรองว่า ได้ให้คำแนะนำ และให้คำปรึกษาตลอดระยะเวลาการดำเนินโครงการจริง</b></div>
        <div class="sig-center" style="margin-left:35%; margin-top:28px;">
          ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(${esc(tName)})<br><br><br>
          ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(..................................................)<br><br><br>
          ลงชื่อ..................................................ที่ปรึกษาโครงการ<br>(..................................................)
        </div>
      </div>`;

    // 3. กพช. 5 (แบบประเมิน + ภาพถ่ายประกอบ)
    const k5Html = buildKPCH5Html(first, false, batchData[0].imagesBase64 || []);

    // 4. กพช. 6 (ใบแจ้งผลกิจกรรมพัฒนาคุณภาพชีวิต รายคน)
    const k6Html = items.map((s, idx) => `
      <div class="${idx === items.length - 1 ? '' : 'memo-page'}">
        <div class="kpch-box-tag">กพช. 6</div>
        <div class="doc-title-center">ใบแจ้งผลกิจกรรมพัฒนาคุณภาพชีวิต<br>(สำหรับสถานศึกษา)</div>
        <div style="margin-top:14px; line-height:1.6;">
          ชื่อสถานศึกษา &nbsp; <b>${SCHOOL_NAME}</b><br>
          รหัสประจำตัวนักศึกษา &nbsp; <b>${esc(s.student_id)}</b> &nbsp;&nbsp; ชื่อ-สกุล &nbsp; <b>${esc(s.student_name)}</b><br>
          ระดับการศึกษา &nbsp; <b>${esc(s.level || '')}</b> &nbsp;&nbsp; ศูนย์การเรียนรู้ระดับตำบล &nbsp; <b>${esc(s.group_name || '-')}</b><br>
          ครูผู้รับผิดชอบ &nbsp; <b>${esc(tName)}</b>
        </div>
        <table class="doc-table" style="margin-top:12px;">
          <thead><tr><th>โครงการ/กิจกรรม</th><th style="width:90px;">ผ่าน</th><th style="width:120px;">จำนวนชั่วโมง</th></tr></thead>
          <tbody>
            <tr><td>1. ${esc(s.activity_name || projName)}</td><td style="text-align:center;">&#10004;</td><td style="text-align:center;">${esc(s.hours || hours)}</td></tr>
            <tr><td>2. ............................................................................</td><td></td><td></td></tr>
            <tr><td>3. ............................................................................</td><td></td><td></td></tr>
            <tr><td>4. ............................................................................</td><td></td><td></td></tr>
            <tr><td>5. ............................................................................</td><td></td><td></td></tr>
            <tr><td>6. ............................................................................</td><td></td><td></td></tr>
            <tr><td style="text-align:center; font-weight:bold;">รวม</td><td></td><td style="text-align:center; font-weight:bold;">${esc(s.hours || hours)}</td></tr>
          </tbody>
        </table>
        <div style="margin-top:16px;">อนุมัติการผ่านกิจกรรม เมื่อวันที่............เดือน..................พ.ศ. ............</div>
        <div class="sig-row-2" style="margin-top:28px;">
          <div class="sig-col">ลงชื่อ..........................................ผู้กรอก<br>(${esc(filler || '..........................................')})<br>ตำแหน่ง..........................................</div>
          <div class="sig-col">ลงชื่อ..........................................ผู้ทาน<br>(${esc(checker || '..........................................')})<br>ตำแหน่ง..........................................</div>
        </div>
        <div class="sig-center" style="margin-top:26px;">
          ลงชื่อ..........................................นายทะเบียน<br>(${esc(regName || '..........................................')})
        </div>
      </div>`).join('');

    document.getElementById('printOnlyContainer').innerHTML = memoHtml + k4Html + k5Html + k6Html;
    setTimeout(() => window.print(), 450);
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== พิมพ์ชุดปะหน้าเดิม + รายละเอียด + กพช.5 ====================
async function printTeacherPresentPackage() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  let targetIds = checkedIds;
  if (targetIds.length === 0) {
    const visibleList = getFilteredDashItems();
    targetIds = (currentUser.role === 'TEACHER' && teacherTabMode === 'present' && presentSubMode === 'SENT')
      ? visibleList.map(x => x.req_id)
      : visibleList.filter(x => x.current_step === 'WAIT_TEACHER_PRESENT').map(x => x.req_id);
  }
  if (targetIds.length === 0) return safeAlert('ไม่พบรายการ', 'กรุณาติ๊กเลือกรายการที่ต้องการพิมพ์ก่อนครับ', 'warning');

  const termFilterVal = document.getElementById('dashTermFilter')?.value || 'ALL';
  const defaultTerm = termFilterVal.startsWith('TERM:') ? termFilterVal.slice(5) : '2/2569';
  const { value: formValues } = await Swal.fire({
    title: `พิมพ์ชุดเอกสารส่งทะเบียน (${targetIds.length} รายการ)`,
    html: `
      <div class="text-start small">
        <label class="form-label fw-bold mb-1">ส่วนราชการ / กลุ่ม</label>
        <input id="swal_dept" class="form-control mb-2" value="${esc(currentUser.group_name ? SCHOOL_NAME + ' (' + currentUser.group_name + ')' : SCHOOL_NAME)}">
        <label class="form-label fw-bold mb-1">เลขที่หนังสือ</label>
        <input id="swal_docno" class="form-control mb-2" value="ศธ. 07058.02/......">
        <label class="form-label fw-bold mb-1">ภาคเรียน / ปีการศึกษา</label>
        <input id="swal_term" class="form-control" value="${esc(defaultTerm)}">
      </div>`,
    showCancelButton: true, confirmButtonText: '🖨️ จัดเตรียมชุดพิมพ์', cancelButtonText: 'ยกเลิก',
    preConfirm: () => ({
      dept: document.getElementById('swal_dept').value.trim() || SCHOOL_NAME,
      docNo: document.getElementById('swal_docno').value.trim() || 'ศธ. 07058.02/............',
      term: document.getElementById('swal_term').value.trim() || '..../........'
    })
  });
  if (!formValues) return;

  showLoading(`กำลังดึงรายละเอียดและรูปภาพ (${targetIds.length} รายการ)...`);
  try {
    const batchData = await callApi('getSubmissionsBatchForPrint', { token: authToken, req_ids: targetIds });
    hideLoading();
    const targetItems = batchData.map(b => b.item);
    const totalHours = targetItems.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    const todayThai = formatThaiDate();
    const tableRowsHtml = targetItems.map((r, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td><td>${esc(r.req_id)}</td><td>${esc(r.student_id)}</td>
        <td>${esc(r.student_name)}</td><td style="text-align:center;">${esc(r.level)}</td><td>${esc(r.activity_name)}</td>
        <td style="text-align:center;">${formatShortThaiDate(r.activity_date)} - ${formatShortThaiDate(r.activity_end_date)}</td>
        <td style="text-align:center;"><b>${esc(r.hours)}</b></td><td>${esc(r.teacher_name)}</td>
      </tr>`).join('');

    const renderCompactDetailCard = (entry, idx, isTopOfPair) => {
      const item = entry.item;
      const imgs = entry.imagesBase64 || [];
      const imgWidthPct = imgs.length >= 3 ? '32%' : '46%';
      const imgsHtml = imgs.map((b64, i) => `<div style="width:${imgWidthPct}; text-align:center;"><img src="${b64}" style="max-height:135px; max-width:100%; object-fit:contain; border:1px solid #999; padding:2px;"><div style="font-size:11.5pt;">ภาพประกอบที่ ${i + 1}</div></div>`).join('');
      const sepStyle = isTopOfPair ? 'border-bottom:1.5px dashed #666; margin-bottom:0.45cm;' : '';
      return `
        <div style="height:12.6cm; overflow:hidden; box-sizing:border-box; padding-bottom:6px; ${sepStyle}">
          <div style="text-align:center; border-bottom:1.5px solid #000; padding-bottom:3px; margin-bottom:6px;">
            <div style="font-size:15pt; font-weight:bold;">รายละเอียดกิจกรรม กพช. และหลักฐานภาพถ่าย (รายการที่ ${idx + 1})</div>
            <div style="font-size:12.5pt;">${SCHOOL_NAME} | รหัส: ${esc(item.req_id)}</div>
          </div>
          <table style="width:100%; border-collapse:collapse; margin-bottom:5px; font-size:13pt;" border="1" cellpadding="3">
            <tr><td><b>ชื่อ-สกุล:</b> ${esc(item.student_name)}</td><td><b>รหัส:</b> ${esc(item.student_id)} (${esc(item.level)})</td></tr>
            <tr><td><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</td><td><b>ชั่วโมง:</b> ${esc(item.hours)} ชม.</td></tr>
            <tr><td><b>ระยะเวลา:</b> ${formatThaiDate(item.activity_date)} ถึง ${formatThaiDate(item.activity_end_date)}</td><td><b>สถานที่:</b> ${esc(item.location || '-')}</td></tr>
          </table>
          <div style="font-size:13pt; margin-bottom:3px;"><b>1. กิจกรรม:</b> ${esc(item.activity_name)}</div>
          <div style="border:1px solid #000; padding:4px 6px; max-height:66px; overflow:hidden; white-space:pre-line; margin-bottom:5px; font-size:12.5pt;">${esc(item.activity_detail)}</div>
          <div style="display:flex; justify-content:space-around; gap:6px;">${imgsHtml}</div>
        </div>`;
    };
    let detailsPagesHtml = '';
    for (let i = 0; i < batchData.length; i += 2) {
      detailsPagesHtml += `<div class="memo-page">${renderCompactDetailCard(batchData[i], i, (i + 1 < batchData.length))}${(i + 1 < batchData.length) ? renderCompactDetailCard(batchData[i + 1], i + 1, false) : ''}</div>`;
    }
    const kpch5PagesHtml = batchData.map((entry, idx) => buildKPCH5Html(entry.item, idx === batchData.length - 1)).join('');

    document.getElementById('printOnlyContainer').innerHTML = `
      <div class="memo-page">
        <div class="memo-header"><img src="${GARUDA_URL}" class="memo-garuda" onerror="this.style.display='none'"><div class="memo-title">บันทึกข้อความ</div></div>
        <div class="memo-field"><b>ส่วนราชการ</b> &nbsp;${esc(formValues.dept)}</div>
        <div class="memo-field" style="display:flex; justify-content:space-between;"><span><b>ที่</b> &nbsp;${esc(formValues.docNo)}</span><span><b>วันที่</b> &nbsp;${todayThai}</span></div>
        <div class="memo-field"><b>เรื่อง</b> &nbsp;ขอส่งผลการดำเนินกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) เพื่อบันทึกชั่วโมงเข้าระบบทะเบียน ประจำภาคเรียนที่ ${esc(formValues.term)}</div>
        <div class="memo-divider"></div>
        <div class="memo-field" style="margin-bottom:10px;"><b>เรียน</b> &nbsp;ผู้อำนวยการ${SCHOOL_NAME} (ผ่านงานทะเบียน)</div>
        <div class="memo-indent">ตามที่นักศึกษา${SCHOOL_NAME} ได้ดำเนินการจัดทำกิจกรรม กพช. ประจำภาคเรียนที่ ${esc(formValues.term)} จำนวนทั้งสิ้น <b>${targetItems.length} ราย</b> รวม <b>${totalHours} ชั่วโมง</b> จึงขอส่งเอกสารหลักฐานพร้อมบัญชีรายชื่อแนบท้ายมาเพื่อบันทึกชั่วโมง กพช. ต่อไป</div>
        <div style="width:60%; margin-left:auto; text-align:center; margin-top:20px;">ลงชื่อ......................................................<br>(${esc(currentUser.full_name)})<br>ผู้นำเสนอส่งทะเบียน</div>
      </div>
      <div class="memo-page">
        <div style="text-align:center; margin-bottom:8px;"><div style="font-size:17pt; font-weight:bold;">บัญชีรายชื่อนักศึกษาผู้ผ่านการพิจารณาอนุมัติกิจกรรม กพช. (ภาคเรียนที่ ${esc(formValues.term)})</div></div>
        <table class="batch-table"><thead><tr><th>ที่</th><th>รหัสอ้างอิง</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ระดับ</th><th>ชื่อกิจกรรม</th><th>ช่วงวันที่จัด</th><th>ชม.</th><th>ครูประจำกลุ่ม</th></tr></thead><tbody>${tableRowsHtml}<tr><td colspan="7" style="text-align:right; font-weight:bold;">รวมทั้งสิ้น (${targetItems.length} รายการ)</td><td style="text-align:center; font-weight:bold;">${totalHours}</td><td style="text-align:center;">ชั่วโมง</td></tr></tbody></table>
      </div>
      ${detailsPagesHtml}
      ${kpch5PagesHtml}
    `;
    setTimeout(() => window.print(), 600);
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

function confirmPresentToRegistrar() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && it.current_step === 'WAIT_TEACHER_PRESENT'; });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่รอนำเสนอส่งทะเบียนอย่างน้อย 1 รายการ', 'warning');
  Swal.fire({
    title: `ยืนยันนำเสนอส่งต่อนายทะเบียน (${validIds.length} รายการ)?`,
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยันส่งต่อนายทะเบียน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังส่งต่อนายทะเบียน...');
      try {
        const r = await callApi('presentToRegistrar', { token: authToken, req_ids: validIds });
        hideLoading(); safeAlert('เรียบร้อย! 📤', `ส่งต่อทะเบียนสำเร็จ ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function openDetailModal(reqId) {
  const item = dashItems.find(x => x.req_id === reqId);
  if (!item) return;
  document.getElementById('mdReqId').innerText = item.req_id;
  const imgs = [item.img_1, item.img_2, item.img_3].filter(Boolean);
  const imgsHtml = imgs.map((url, idx) => `
    <div class="col-6 col-md-4"><a href="${esc(url)}" target="_blank"><img src="${getDriveThumb(url)}" class="img-fluid rounded-3 border" style="height:140px; width:100%; object-fit:cover;"></a><div class="text-center small text-muted mt-1">ภาพที่ ${idx + 1}</div></div>
  `).join('');
  const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
  document.getElementById('detailModalBody').innerHTML = `
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div><span class="badge step-badge ${st.cls}">${st.text}</span> ${item.category ? `<span class="badge bg-info bg-opacity-10 text-dark border ms-1">${esc(item.category)}</span>` : ''}</div>
      <span class="text-muted small">ส่งเมื่อ: ${esc(item.created_at)}</span>
    </div>
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
    <p style="white-space: pre-line;" class="border p-3 rounded-3 bg-white">${esc(item.activity_detail)}</p>
    <h6 class="fw-bold mt-3">ภาพถ่ายกิจกรรม:</h6><div class="row g-2 mb-3">${imgsHtml}</div>
    ${item.reject_reason ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(item.reject_reason)}</div>` : ''}
  `;
  const canAct = isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
  const isAdmin = currentUser.role === 'ADMIN';
  document.getElementById('detailModalFooter').innerHTML = `
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="printProjectPDF('${esc(item.req_id)}')"><i class="bi bi-printer me-1"></i>พิมพ์บันทึกข้อความ + โครงการ + กพช.5</button>
      ${isAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="confirmDeleteSubmissions(['${esc(item.req_id)}'])"><i class="bi bi-trash me-1"></i>ย้ายลงถังขยะ</button>` : ''}
    </div>
    <div class="d-flex flex-wrap gap-2">
      ${canAct ? `
        <button type="button" class="btn btn-danger rounded-pill px-3 fw-bold" onclick="submitDecision('${esc(item.req_id)}', 'REJECT')"><i class="bi bi-x-circle me-1"></i>ตีกลับ (ระบุเหตุผล)</button>
        <button type="button" class="btn btn-success rounded-pill px-3 fw-bold" onclick="submitDecision('${esc(item.req_id)}', 'APPROVE')"><i class="bi bi-check-circle me-1"></i>อนุมัติส่งต่อ</button>
      ` : ''}
      <button type="button" class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">ปิด</button>
    </div>
  `;
  openModalById('detailModal');
}

function submitDecision(reqId, decision) {
  // ปิด Modal ก่อนเพื่อไม่ให้แย่ง Focus จากช่องพิมพ์เหตุผล
  closeModalById('detailModal');
  setTimeout(() => {
    if (decision === 'APPROVE') {
      Swal.fire({
        title: 'ยืนยันการอนุมัติ?',
        text: `ต้องการอนุมัติคำขอ ${reqId} เพื่อส่งต่อไปยังขั้นตอนถัดไปใช่หรือไม่`,
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'ยืนยันอนุมัติ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
      }).then(res => { if (res.isConfirmed) executeApproval(reqId, 'APPROVE', ''); });
    } else {
      Swal.fire({
        title: 'ระบุเหตุผลในการตีกลับ',
        input: 'textarea',
        inputPlaceholder: 'เช่น รูปภาพไม่ชัดเจน, กรอกข้อมูล กพช.4 ไม่ครบ, ชั่วโมงผิด กรุณาส่งใหม่...',
        showCancelButton: true, confirmButtonText: 'ส่งตีกลับ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444',
        inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; }
      }).then(res => { if (res.isConfirmed) executeApproval(reqId, 'REJECT', res.value); });
    }
  }, 220);
}

async function executeApproval(reqId, decision, reason) {
  showLoading('กำลังบันทึกผลการพิจารณา...');
  try {
    await callApi('processApproval', { token: authToken, req_id: reqId, decision, reason });
    hideLoading();
    safeAlert('สำเร็จ', 'บันทึกผลเรียบร้อยแล้ว', 'success');
    await loadDashboard();
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

async function printProjectPDF(reqId) {
  showLoading('กำลังจัดเตรียมเอกสาร...');
  try {
    const data = await callApi('getSubmissionForPrint', { token: authToken, req_id: reqId });
    hideLoading();
    const item = data.item;
    const imgs = data.imagesBase64 || [];
    const imgWidthPct = imgs.length >= 3 ? '32%' : '48%';
    const imgsHtml = imgs.map((b64, i) => `<div style="width:${imgWidthPct}; text-align:center;"><img src="${b64}"><div style="font-size:13pt;">ภาพประกอบที่ ${i + 1}</div></div>`).join('');
    const todayThai = formatThaiDate();
    const startThai = formatThaiDate(item.activity_date);
    const endThai = formatThaiDate(item.activity_end_date);

    document.getElementById('printOnlyContainer').innerHTML = `
      <div class="memo-page">
        <div class="memo-header"><img src="${GARUDA_URL}" class="memo-garuda" onerror="this.style.display='none'"><div class="memo-title">บันทึกข้อความ</div></div>
        <div class="memo-field"><b>ส่วนราชการ</b> &nbsp;${SCHOOL_NAME}</div>
        <div class="memo-field" style="display:flex; justify-content:space-between;"><span><b>ที่</b> &nbsp;ศธ. 07058.02/............</span><span><b>วันที่</b> &nbsp;${todayThai}</span></div>
        <div class="memo-field"><b>เรื่อง</b> &nbsp;ขออนุมัติรับรองผลการทำกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) รายบุคคล</div>
        <div class="memo-divider"></div>
        <div class="memo-field" style="margin-bottom:10px;"><b>เรียน</b> &nbsp;ผู้อำนวยการ${SCHOOL_NAME}</div>
        <div class="memo-indent">ด้วย <b>${esc(item.student_name)}</b> รหัสนักศึกษา <b>${esc(item.student_id)}</b> ระดับชั้น <b>${esc(item.level)}</b> ได้ดำเนินการจัดทำกิจกรรม กพช. เรื่อง <b>"${esc(item.activity_name)}"</b> ระหว่างวันที่ ${startThai} ถึงวันที่ ${endThai} ณ ${esc(item.location || '-')} รวมจำนวน <b>${esc(item.hours)} ชั่วโมง</b> จึงขออนุมัติชั่วโมง กพช. ตามรายละเอียดที่แนบมาพร้อมนี้</div>
        <div style="width:60%; margin-left:auto; text-align:center; margin-top:20px;">ลงชื่อ......................................................<br>(${esc(item.teacher_name)})<br>ครูประจำกลุ่ม / ผู้เสนอโครงการ</div>
        <div style="border:1px solid #000; padding:10px 14px; margin-top:20px;"><b>ความเห็น / คำสั่งผู้อำนวยการสถานศึกษา</b><br><div style="margin:6px 0 12px 20px;">[ &nbsp; ] อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] ไม่อนุมัติ</div><div style="width:60%; margin-left:auto; text-align:center;">ลงชื่อ......................................................<br>(${DIRECTOR_NAME})<br>ผู้อำนวยการ${SCHOOL_NAME}</div></div>
      </div>
      <div class="memo-page">
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:10px;"><div style="font-size:18pt; font-weight:bold;">รายละเอียดกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) และหลักฐานภาพถ่าย</div><div style="font-size:14pt;">${SCHOOL_NAME} | รหัสอ้างอิง: ${esc(item.req_id)}</div></div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:15pt;" border="1" cellpadding="4">
          <tr><td><b>ชื่อ-สกุล:</b> ${esc(item.student_name)}</td><td><b>รหัสนักศึกษา:</b> ${esc(item.student_id)} (${esc(item.level)})</td></tr>
          <tr><td><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</td><td><b>จำนวนชั่วโมง:</b> ${esc(item.hours)} ชั่วโมง</td></tr>
          <tr><td><b>ระยะเวลา:</b> ${startThai} ถึง ${endThai}</td><td><b>สถานที่:</b> ${esc(item.location || '-')}</td></tr>
        </table>
        <div style="margin-bottom:4px;"><b>1. ชื่อกิจกรรม:</b> ${esc(item.activity_name)}</div>
        <div style="border:1px solid #000; padding:8px; min-height:60px; white-space:pre-line; margin-bottom:10px; font-size:15pt;">${esc(item.activity_detail)}</div>
        <div class="print-img-box" style="display:flex; justify-content:space-around; gap:8px;">${imgsHtml}</div>
      </div>
      ${buildKPCH5Html(item, true)}
    `;
    setTimeout(() => window.print(), 600);
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

async function printBatchMemo() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  let targetItems = checkedIds.length > 0
    ? dashItems.filter(x => checkedIds.includes(x.req_id))
    : currentFilteredSubs.filter(x => ['WAIT_TEACHER_PRESENT', 'APPROVED_FOR_REGISTRAR', 'COMPLETED'].includes(x.current_step));

  if (targetItems.length === 0) return safeAlert('ไม่พบรายการ', 'กรุณาติ๊กเลือกรายการที่ต้องการพิมพ์สรุปรวมก่อนครับ', 'info');
  const termFilterVal = document.getElementById('dashTermFilter')?.value || 'ALL';
  const defaultTerm = termFilterVal.startsWith('TERM:') ? termFilterVal.slice(5) : '2/2569';
  const { value: formValues } = await Swal.fire({
    title: `จัดทำบันทึกข้อความสรุปรวม (${targetItems.length} รายการ)`,
    html: `<div class="text-start small"><label class="form-label fw-bold mb-1">ส่วนราชการ</label><input id="swal_dept" class="form-control mb-2" value="${SCHOOL_NAME}"><label class="form-label fw-bold mb-1">เลขที่หนังสือ</label><input id="swal_docno" class="form-control mb-2" value="ศธ. 07058.02/......"><label class="form-label fw-bold mb-1">ภาคเรียน</label><input id="swal_term" class="form-control" value="${esc(defaultTerm)}"></div>`,
    showCancelButton: true, confirmButtonText: '🖨️ พิมพ์', cancelButtonText: 'ยกเลิก',
    preConfirm: () => ({
      dept: document.getElementById('swal_dept').value.trim() || SCHOOL_NAME,
      docNo: document.getElementById('swal_docno').value.trim() || 'ศธ. 07058.02/............',
      term: document.getElementById('swal_term').value.trim() || '..../........'
    })
  });
  if (!formValues) return;

  const totalHours = targetItems.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const todayThai = formatThaiDate();
  const tableRowsHtml = targetItems.map((r, idx) => `
    <tr><td style="text-align:center;">${idx + 1}</td><td>${esc(r.req_id)}</td><td>${esc(r.student_id)}</td><td>${esc(r.student_name)}</td><td style="text-align:center;">${esc(r.level)}</td><td>${esc(r.activity_name)}</td><td style="text-align:center;">${formatShortThaiDate(r.activity_date)} - ${formatShortThaiDate(r.activity_end_date)}</td><td style="text-align:center;"><b>${esc(r.hours)}</b></td><td>${esc(r.teacher_name)}</td></tr>`).join('');

  document.getElementById('printOnlyContainer').innerHTML = `
    <div class="memo-page">
      <div class="memo-header"><img src="${GARUDA_URL}" class="memo-garuda" onerror="this.style.display='none'"><div class="memo-title">บันทึกข้อความ</div></div>
      <div class="memo-field"><b>ส่วนราชการ</b> &nbsp;${esc(formValues.dept)}</div>
      <div class="memo-field" style="display:flex; justify-content:space-between;"><span><b>ที่</b> &nbsp;${esc(formValues.docNo)}</span><span><b>วันที่</b> &nbsp;${todayThai}</span></div>
      <div class="memo-field"><b>เรื่อง</b> &nbsp;ขออนุมัติผลการดำเนินกิจกรรม กพช. และบันทึกชั่วโมงเข้าระบบทะเบียน ประจำภาคเรียนที่ ${esc(formValues.term)}</div>
      <div class="memo-divider"></div>
      <div class="memo-field"><b>เรียน</b> &nbsp;ผู้อำนวยการ${SCHOOL_NAME}</div>
      <div class="memo-indent">ตามที่นักศึกษาได้ดำเนินกิจกรรม กพช. ประจำภาคเรียนที่ ${esc(formValues.term)} จำนวนทั้งสิ้น <b>${targetItems.length} ราย</b> รวม <b>${totalHours} ชั่วโมง</b> จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติและมอบหมายงานทะเบียนบันทึกชั่วโมง กพช. ต่อไป</div>
      <div style="width:60%; margin-left:auto; text-align:center; margin-top:20px;">ลงชื่อ......................................................<br>(${esc(currentUser.full_name)})</div>
      <div style="border:1px solid #000; padding:10px 14px; margin-top:20px;"><b>คำสั่งผู้อำนวยการสถานศึกษา</b><br><div style="margin:6px 0 12px 20px;">[ &nbsp; ] อนุมัติ และมอบหมายงานทะเบียนดำเนินการต่อไป</div><div style="width:60%; margin-left:auto; text-align:center;">ลงชื่อ......................................................<br>(${DIRECTOR_NAME})<br>ผู้อำนวยการ${SCHOOL_NAME}</div></div>
    </div>
    <div>
      <div style="text-align:center; margin-bottom:8px;"><div style="font-size:17pt; font-weight:bold;">บัญชีรายชื่อนักศึกษาผู้ผ่านการพิจารณาอนุมัติกิจกรรม กพช. (ภาคเรียนที่ ${esc(formValues.term)})</div></div>
      <table class="batch-table"><thead><tr><th>ที่</th><th>รหัสอ้างอิง</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ระดับ</th><th>ชื่อกิจกรรม</th><th>ช่วงวันที่จัด</th><th>ชม.</th><th>ครูประจำกลุ่ม</th></tr></thead><tbody>${tableRowsHtml}<tr><td colspan="7" style="text-align:right; font-weight:bold;">รวมทั้งสิ้น (${targetItems.length} รายการ)</td><td style="text-align:center; font-weight:bold;">${totalHours}</td><td style="text-align:center;">ชั่วโมง</td></tr></tbody></table>
    </div>`;
  setTimeout(() => window.print(), 500);
}

// ==================== นายทะเบียน & แอดมิน ====================
function exportRegistrarCSV() {
  const approved = currentFilteredSubs.filter(x => x.current_step === 'APPROVED_FOR_REGISTRAR');
  if (approved.length === 0) return safeAlert('แจ้งเตือน', 'ไม่มีรายการที่รอลงทะเบียนตามเงื่อนไขที่เลือก', 'info');
  const headers = ['ลำดับ', 'รหัสคำขอ', 'รหัส กพช.1-3', 'ภาคเรียน', 'ประเภท กพช.', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'ระดับชั้น', 'ครูประจำกลุ่ม', 'ชื่อกิจกรรม', 'วันที่เริ่ม', 'วันสิ้นสุด', 'สถานที่', 'จำนวนชั่วโมง'];
  const csvEscape = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const lines = [headers.map(csvEscape).join(',')];
  approved.forEach((r, idx) => {
    lines.push([idx + 1, r.req_id, r.ref_12_id || '-', getItemTerm(r) || '-', r.category || '-', r.student_id, r.student_name, r.level, r.teacher_name, r.activity_name, formatShortThaiDate(r.activity_date), formatShortThaiDate(r.activity_end_date), r.location, r.hours].map(csvEscape).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `รายชื่ออนุมัติ_กพช_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function confirmRegistrarComplete() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const validIds = checkedIds.filter(id => { const it = dashItems.find(x => x.req_id === id); return it && it.current_step === 'APPROVED_FOR_REGISTRAR'; });
  if (validIds.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่รอนายทะเบียน', 'warning');
  Swal.fire({ title: `ยืนยันปิดงาน ${validIds.length} รายการ?`, icon: 'question', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังอัปเดต...');
      try {
        const r = await callApi('markRegistrarCompleted', { token: authToken, req_ids: validIds });
        hideLoading(); safeAlert('เรียบร้อย', `ปิดงานสำเร็จ ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
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
  const subsBody = document.getElementById('trashSubsBody');
  const req12Body = document.getElementById('trash12Body');
  if (subsBody) {
    subsBody.innerHTML = adminTrashSubs.length === 0
      ? '<tr><td colspan="6" class="text-center py-4 text-muted">ไม่มีรายการในถังขยะ</td></tr>'
      : adminTrashSubs.map(item => `<tr><td><b>${esc(item.req_id)}</b></td><td>${esc(item.student_name)} (${esc(item.student_id)})</td><td>${esc(item.activity_name)}</td><td>${esc(item.current_step)}</td><td class="small">${esc(item.deleted_at)}<br>${esc(item.deleted_by)}</td><td class="text-end text-nowrap"><button class="btn btn-success btn-sm rounded-pill me-1" onclick="confirmRestoreTrash('SUB', '${esc(item.req_id)}')">♻️ กู้คืน</button><button class="btn btn-outline-danger btn-sm rounded-pill" onclick="confirmPurgeTrash('SUB', '${esc(item.req_id)}')">🔥 ลบถาวร</button></td></tr>`).join('');
  }
  if (req12Body) {
    req12Body.innerHTML = adminTrash12.length === 0
      ? '<tr><td colspan="6" class="text-center py-4 text-muted">ไม่มีรายการในถังขยะ</td></tr>'
      : adminTrash12.map(item => `<tr><td><b>${esc(item.req12_id)}</b></td><td>${esc(item.student_name)} (${esc(item.student_id)})</td><td>${esc(item.activity_name)}</td><td>${esc(item.status_12)}</td><td class="small">${esc(item.deleted_at)}<br>${esc(item.deleted_by)}</td><td class="text-end text-nowrap"><button class="btn btn-success btn-sm rounded-pill me-1" onclick="confirmRestoreTrash('12', '${esc(item.req12_id)}')">♻️ กู้คืน</button><button class="btn btn-outline-danger btn-sm rounded-pill" onclick="confirmPurgeTrash('12', '${esc(item.req12_id)}')">🔥 ลบถาวร</button></td></tr>`).join('');
  }
}

function confirmRestoreTrash(trashType, itemId) {
  Swal.fire({ title: `♻️ กู้คืน ${esc(itemId)}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'กู้คืน', confirmButtonColor: '#10b981' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังกู้คืน...');
      try { await callApi('restoreTrash', { token: authToken, trash_type: trashType, item_id: itemId }); hideLoading(); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function confirmPurgeTrash(trashType, itemId) {
  Swal.fire({ title: `🔥 ยืนยันลบถาวร ${esc(itemId)}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบถาวร', confirmButtonColor: '#dc2626' }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังลบถาวร...');
      try { await callApi('purgeTrash', { token: authToken, trash_type: trashType, item_id: itemId }); hideLoading(); await loadDashboard(); }
      catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
    }
  });
}

function renderAdminUsers() {
  document.getElementById('adminUsersBody').innerHTML = adminUsers.map(u => `
    <tr>
      <td>${esc(u.user_id)}</td><td><b>${esc(u.username)}</b></td><td>${esc(u.full_name)}</td>
      <td><span class="badge bg-info text-dark">${ROLE_LABELS[u.role] || u.role}</span></td><td>${esc(u.group_name)}</td>
      <td><span class="badge ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}">${esc(u.status)}</span></td>
      <td><button type="button" class="btn btn-warning btn-sm rounded-pill" onclick="openUserModal('${esc(u.user_id)}')"><i class="bi bi-pencil"></i> แก้ไข</button></td>
    </tr>`).join('');
}

function renderAdminLogs() {
  document.getElementById('adminLogsBody').innerHTML = adminLogs.map(l => `
    <tr><td class="text-nowrap">${esc(l.timestamp)}</td><td><b>${esc(l.req_id)}</b></td><td>${esc(l.actor_name)}</td><td>${esc(l.actor_role)}</td><td><span class="badge bg-secondary">${esc(l.action)}</span></td><td>${esc(l.remark)}</td></tr>`).join('');
}

function openUserModal(userId) {
  const isEdit = !!userId;
  document.getElementById('userModalTitle').innerText = isEdit ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่';
  document.getElementById('u_username').readOnly = isEdit;
  document.getElementById('u_pass_hint').innerText = isEdit ? '(เว้นว่างหากไม่เปลี่ยน)' : '(จำเป็น)';
  document.getElementById('u_status_wrap').classList.toggle('d-none', !isEdit);
  if (isEdit) {
    const u = adminUsers.find(x => x.user_id === userId);
    document.getElementById('u_id').value = u.user_id; document.getElementById('u_username').value = u.username;
    document.getElementById('u_fullname').value = u.full_name; document.getElementById('u_role').value = u.role;
    document.getElementById('u_group').value = u.group_name; document.getElementById('u_status').value = u.status;
    document.getElementById('u_password').value = '';
  } else {
    ['u_id','u_username','u_fullname','u_group','u_password'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('u_role').value = 'TEACHER'; document.getElementById('u_status').value = 'ACTIVE';
  }
  openModalById('userModal');
}

async function handleSaveUser() {
  const uid = document.getElementById('u_id').value;
  const uname = document.getElementById('u_username').value.trim();
  const fname = document.getElementById('u_fullname').value.trim();
  const pass = document.getElementById('u_password').value;
  if (!uname || !fname || (!uid && !pass)) return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ', 'warning');
  showLoading('กำลังบันทึกบุคลากร...');
  try {
    await callApi('saveUserAdmin', {
      token: authToken,
      user_data: { user_id: uid, username: uname, full_name: fname, role: document.getElementById('u_role').value, group_name: document.getElementById('u_group').value.trim(), new_password: pass, status: document.getElementById('u_status').value }
    });
    hideLoading(); closeModalById('userModal'); safeAlert('สำเร็จ', 'บันทึกบุคลากรเรียบร้อยแล้ว', 'success');
    await loadDashboard();
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

async function handleSaveAnnouncement() {
  const fileInput = document.getElementById('ann_pdf_file');
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (file && file.size > 8 * 1024 * 1024) return safeAlert('ไฟล์ใหญ่เกินไป', 'เลือกไฟล์ PDF ไม่เกิน 8 MB', 'warning');
  showLoading('กำลังบันทึกข่าวประกาศ...');
  try {
    let pdfFilePayload = null;
    if (file) pdfFilePayload = { name: file.name, base64Data: await readFileAsBase64(file) };
    const res = await callApi('saveAnnouncement', {
      token: authToken,
      announcement: { visible: document.getElementById('ann_visible').checked, badge: document.getElementById('ann_badge').value.trim(), content: document.getElementById('ann_content').value.trim(), remove_pdf: document.getElementById('ann_remove_pdf')?.checked || false, pdf_file: pdfFilePayload }
    });
    hideLoading(); renderAnnouncement(res.announcement); renderAdminAnnPdfBox(res.announcement);
    safeAlert('สำเร็จ', 'อัปเดตข่าวประกาศเรียบร้อยแล้ว', 'success');
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

async function handleChangeMyPassword() {
  const oldPass = document.getElementById('cp_old').value;
  const newPass = document.getElementById('cp_new').value;
  const confirmPass = document.getElementById('cp_confirm').value;
  if (!oldPass || !newPass || newPass.length < 4 || newPass !== confirmPass) {
    return safeAlert('แจ้งเตือน', 'กรุณากรอกรหัสผ่านให้ถูกต้องและตรงกัน (อย่างน้อย 4 ตัวอักษร)', 'warning');
  }
  showLoading('กำลังเปลี่ยนรหัสผ่าน...');
  try {
    await callApi('changePassword', { token: authToken, old_pass: oldPass, new_pass: newPass });
    hideLoading(); ['cp_old','cp_new','cp_confirm'].forEach(id => document.getElementById(id).value = '');
    closeModalById('changePassModal'); safeAlert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
  } catch (err) { hideLoading(); safeAlert('ผิดพลาด', err.message, 'error'); }
}

// ==================== เริ่มทำงาน ====================
function initApp() {
  const preloadGaruda = new Image();
  preloadGaruda.src = GARUDA_URL;
  renderNavbar();
  loadPublicData();
  const savedToken = sessionStorage.getItem('kpch_token');
  if (savedToken) {
    authToken = savedToken;
    loadDashboard(true);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();
