const API_URL = 'https://script.google.com/macros/s/AKfycbwuuQeFT7Ikjcr4GeTrwdY_7I4hJ-Ksgs4dWWYV1us8lOe02233vtOgv0TTyPwgM9Vu/exec';
const SCHOOL_NAME = 'ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอคลองหลวง';
const DIRECTOR_NAME = 'นางฑัศดาพร ลองชัย';
const GARUDA_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Garuda_Emblem_of_Thailand_%28Monochrome_2%29.svg';

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
let authToken = null;
let currentUser = null;
let dashItems = [];
let dash12Items = [];
let adminUsers = [];
let adminLogs = [];
let publicTeachersList = [];
let registrarName = '';
let filterMode = 'PENDING';
let filter12Mode = 'PENDING';
let currentEligibleList12 = [];

const STEP_LABELS = {
  'WAIT_TEACHER': { text: 'รอครูประจำกลุ่มอนุมัติ', cls: 'bg-warning text-dark' },
  'WAIT_COMM_1': { text: 'รอกรรมการ 1 อนุมัติ', cls: 'bg-info text-dark' },
  'WAIT_COMM_2': { text: 'รอกรรมการ 2 อนุมัติ', cls: 'bg-info text-dark' },
  'WAIT_COMM_3': { text: 'รอกรรมการ 3 อนุมัติ', cls: 'bg-info text-dark' },
  'WAIT_DIRECTOR': { text: 'รอ ผอ. อนุมัติโครงการ', cls: 'bg-primary text-white' },
  'APPROVED_FOR_REGISTRAR': { text: 'ผอ.อนุมัติแล้ว (รอนายทะเบียน)', cls: 'bg-success text-white' },
  'COMPLETED': { text: 'บันทึกทะเบียนเรียบร้อย', cls: 'bg-dark text-white' },
  'REJECTED': { text: 'ถูกตีกลับให้แก้ไข', cls: 'bg-danger text-white' }
};

const STEP12_LABELS = {
  'WAIT_TEACHER_12': { text: 'รอครูอนุมัติ กพช.1-2', cls: 'bg-warning text-dark' },
  'APPROVED_12': { text: 'อนุมัติให้ทำกิจกรรมแล้ว', cls: 'bg-success text-white' },
  'REJECTED_12': { text: 'ไม่อนุมัติ / แก้ไข กพช.1-2', cls: 'bg-danger text-white' }
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

// ==================== เชื่อมต่อ API Google Apps Script ====================
async function callApi(action, params = {}) {
  if (!API_URL || API_URL.includes('วาง_URL_ของ')) {
    throw new Error('กรุณานำลิงก์ /exec จาก Apps Script มาวางในตัวแปร API_URL บรรทัดที่ 1 ก่อนครับ');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...params })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
  return json.data;
}

// ==================== ฟังก์ชันช่วยเหลือ ====================
function showLoading(msg) {
  document.getElementById('loadingText').innerText = msg || 'กำลังดำเนินการ...';
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}
function esc(str) {
  if (!str) return '';
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
function dotVal(text, dotCount = 5) {
  const d = '.'.repeat(dotCount);
  const v = esc(text);
  return v ? `${d}${v}${d}` : '.'.repeat(dotCount * 3);
}
function toInputDate(val) {
  if (!val) return '';
  return String(val).split(' ')[0];
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

// ==================== ส่วนหน้าแรก (นักศึกษา: กพช.1-2 + ส่งผล + เช็กสถานะ) ====================
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
  if (!ann || !ann.visible) {
    box.classList.add('d-none');
    return;
  }
  box.classList.remove('d-none');
  document.getElementById('annBadgeText').innerText = ann.badge || '';
  document.getElementById('annContentText').innerText = ann.content || '';
}

async function loadPublicData() {
  const sel1 = document.getElementById('p12_teacher_id');
  const sel2 = document.getElementById('f_teacher_id');
  const errEl = document.getElementById('teacherLoadError');
  try {
    const data = await callApi('getPublicData');
    errEl.classList.add('d-none');
    renderAnnouncement(data.announcement);

    publicTeachersList = data.teachers || [];
    const html = publicTeachersList.length === 0
      ? '<option value="">-- ยังไม่มีรายชื่อครูในระบบ --</option>'
      : '<option value="">-- กรุณาเลือกครูประจำกลุ่ม --</option>' +
        publicTeachersList.map(t => `<option value="${esc(t.user_id)}">${esc(t.full_name)} (${esc(t.group_name)})</option>`).join('');

    sel1.innerHTML = html;
    sel2.innerHTML = html;
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
  if (t && t.group_name) {
    document.getElementById('p12_group_name').value = t.group_name;
  }
}

// --- 1. ยื่นขออนุมัติทำ กพช. (กพช.1-2) ---
async function handlePre12Submit() {
  const sid = document.getElementById('p12_student_id').value.trim();
  const sname = document.getElementById('p12_student_name').value.trim();
  const lvl = document.getElementById('p12_level').value;
  const tid = document.getElementById('p12_teacher_id').value;
  const grp = document.getElementById('p12_group_name').value.trim();
  const term = document.getElementById('p12_term').value.trim();
  const hrs = document.getElementById('p12_hours').value;
  const actName = document.getElementById('p12_activity_name').value.trim();
  const startDate = document.getElementById('p12_start_date').value;
  const endDate = document.getElementById('p12_end_date').value;
  const loc = document.getElementById('p12_location').value.trim();
  const detail = document.getElementById('p12_plan_detail').value.trim();
  const evalOk = document.getElementById('p12_self_eval_ok').checked;

  if (!sid || !sname || !lvl || !tid || !grp || !hrs || !actName || !startDate || !endDate || !detail) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบทุกช่อง', 'warning');
  }
  if (endDate < startDate) {
    return safeAlert('วันที่ไม่ถูกต้อง', 'วันที่คาดว่าจะสิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม', 'warning');
  }

  const evalScores = [];
  for (let i = 1; i <= 10; i++) {
    const checked = document.querySelector(`input[name="eval_q${i}"]:checked`);
    if (!checked) {
      return safeAlert('แบบประเมินยังไม่ครบ', `กรุณาเลือกคำตอบในตารางแบบประเมินตนเอง (กพช. 2) ข้อที่ ${i} ด้วยครับ`, 'warning');
    }
    evalScores.push(checked.value);
  }

  if (!evalOk) {
    return safeAlert('กรุณายืนยัน', 'กรุณาติ๊กถูกช่องรับรองข้อมูลด้านล่างก่อนยื่นคำขอ', 'warning');
  }

  showLoading('กำลังส่งคำขออนุมัติ กพช.1-2...');
  try {
    const res = await callApi('submitPreApproval12', {
      payload: {
        student_id: sid, student_name: sname, level: lvl, teacher_id: tid, group_name: grp,
        term, hours: hrs, activity_name: actName, plan_start_date: startDate,
        plan_end_date: endDate, location: loc, plan_detail: detail,
        eval_scores: evalScores, self_eval_ok: evalOk
      }
    });
    hideLoading();
    safeAlert(
      'ยื่นขอ กพช.1-2 สำเร็จ! 📋',
      `รหัสคำขอของคุณคือ <b class="text-primary">${esc(res.req12_id)}</b><br>กรุณารอครูประจำกลุ่มกดอนุมัติก่อนจึงจะส่งบันทึกผลงานได้ (เช็กผลได้ที่แท็บ "เช็กสถานะ")`,
      'success'
    );
    ['p12_student_id','p12_student_name','p12_level','p12_teacher_id','p12_group_name','p12_hours','p12_activity_name','p12_start_date','p12_end_date','p12_location','p12_plan_detail'].forEach(id => {
      document.getElementById(id).value = '';
    });
    for (let i = 1; i <= 10; i++) {
      document.querySelectorAll(`input[name="eval_q${i}"]`).forEach(el => el.checked = false);
    }
    document.getElementById('p12_self_eval_ok').checked = false;
  } catch (err) {
    hideLoading();
    safeAlert('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// --- 2. ตรวจสอบสิทธิ์ กพช.1-2 ก่อนให้ส่งบันทึกผลงาน ---
function resetSubmitLock(btnText) {
  const btn = document.getElementById('btnSubmitKPCH');
  btn.disabled = true;
  btn.innerHTML = `<i class="bi bi-lock me-2"></i>${btnText || 'กรุณาตรวจสอบสิทธิ์ กพช.1-2 ด้านบนก่อนส่งผลงาน'}`;
  document.getElementById('ref12SelectWrap').classList.add('d-none');
  document.getElementById('f_ref_12_id').innerHTML = '';
  currentEligibleList12 = [];
}

async function checkEligibilityUI() {
  const sid = document.getElementById('f_student_id').value.trim();
  const banner = document.getElementById('eligibilityBanner');
  if (!sid) {
    return safeAlert('แจ้งเตือน', 'กรุณากรอกรหัสนักศึกษาก่อนกดตรวจสอบสิทธิ์', 'warning');
  }

  showLoading('กำลังตรวจสอบสิทธิ์ กพช.1-2...');
  try {
    const res = await callApi('checkEligibility', { student_id: sid });
    hideLoading();
    banner.classList.remove('d-none');

    if (!res.hasAny12) {
      resetSubmitLock('ไม่สามารถส่งได้ (ยังไม่ได้ขออนุมัติ กพช.1-2)');
      banner.innerHTML = `
        <div class="alert alert-danger mb-0 rounded-3 small">
          <div class="fw-bold mb-1">❌ ยังไม่พบคำขออนุมัติทำ กพช. (กพช.1-2) ของรหัส ${esc(sid)}</div>
          <div>นักศึกษาต้องยื่นขอ กพช.1-2 และได้รับอนุมัติจากครูก่อน จึงจะส่งบันทึกผลงานได้</div>
          <button type="button" class="btn btn-danger btn-sm rounded-pill mt-2 fw-bold" onclick="goToPre12WithId('${esc(sid)}')">
            📋 ไปหน้าขออนุมัติ กพช.1-2 ทันที
          </button>
        </div>
      `;
      return;
    }

    const avail = res.availableApproved12 || [];
    if (avail.length === 0) {
      const latest = res.approvals12[0];
      const st = STEP12_LABELS[latest.status_12] || { text: latest.status_12 };
      if (latest.is_used) {
        resetSubmitLock('คำขอ กพช.1-2 ที่อนุมัติถูกใช้ส่งผลงานครบแล้ว');
        banner.innerHTML = `
          <div class="alert alert-info mb-0 rounded-3 small">
            <div class="fw-bold mb-1">ℹ️ คุณได้ส่งบันทึกผลงานสำหรับ กพช.1-2 ที่ได้รับอนุมัติครบแล้ว</div>
            <div>หากต้องการทำกิจกรรม/โครงการใหม่ กรุณายื่นขอ กพช.1-2 เพิ่มเติมก่อนครับ</div>
            <button type="button" class="btn btn-primary btn-sm rounded-pill mt-2 fw-bold" onclick="goToPre12WithId('${esc(sid)}')">
              📋 ขออนุมัติ กพช.1-2 โครงการใหม่
            </button>
          </div>
        `;
      } else {
        resetSubmitLock('รอครูอนุมัติ กพช.1-2 ก่อนจึงจะส่งผลงานได้');
        banner.innerHTML = `
          <div class="alert alert-warning mb-0 rounded-3 small">
            <div class="fw-bold mb-1">⏳ ยังไม่สามารถส่งบันทึกผลงานได้ (สถานะล่าสุด: ${st.text})</div>
            <div>รหัสคำขอ: <b>${esc(latest.req12_id)}</b> | โครงการ: ${esc(latest.activity_name)}</div>
            ${latest.status_12 === 'REJECTED_12' ? `<div class="text-danger mt-1"><b>เหตุผลที่ไม่ผ่าน:</b> ${esc(latest.reject_reason_12)} <button type="button" class="btn btn-outline-danger btn-sm rounded-pill ms-1" onclick="goToPre12WithId('${esc(sid)}')">ยื่นขอใหม่</button></div>` : '<div>กรุณารอครูประจำกลุ่มกดอนุมัติ กพช.1-2 ให้เรียบร้อยก่อนครับ</div>'}
          </div>
        `;
      }
      return;
    }

    currentEligibleList12 = avail;
    banner.innerHTML = `
      <div class="alert alert-success mb-0 rounded-3 small">
        <b>✅ ผ่านการตรวจสอบสิทธิ์ กพช.1-2 แล้ว!</b> (พบ ${avail.length} โครงการที่อนุมัติและรอส่งผลงาน)
      </div>
    `;
    const wrap = document.getElementById('ref12SelectWrap');
    const sel = document.getElementById('f_ref_12_id');
    wrap.classList.remove('d-none');
    sel.innerHTML = avail.map(x => `<option value="${esc(x.req12_id)}">${esc(x.req12_id)} - ${esc(x.activity_name)} (${esc(x.hours)} ชม.)</option>`).join('');
    onSelectApproved12();

    const btn = document.getElementById('btnSubmitKPCH');
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-send-heart me-2"></i>ส่งบันทึกขอ กพช.`;
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
  document.getElementById('f_hours').value = found.hours || '';
  document.getElementById('f_activity_name').value = found.activity_name || '';
  document.getElementById('f_activity_date').value = toInputDate(found.plan_start_date);
  document.getElementById('f_activity_end_date').value = toInputDate(found.plan_end_date);
  document.getElementById('f_location').value = found.location || '';
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
      compressedImages.push({
        name: file.name,
        mimeType: 'image/jpeg',
        base64Data: b64.split(',')[1]
      });
      box.innerHTML += `<img src="${b64}" class="thumb-preview">`;
    }
  } catch (err) {
    safeAlert('ผิดพลาด', 'ไม่สามารถอ่านไฟล์รูปภาพได้', 'error');
  } finally {
    hideLoading();
  }
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
  const tid = document.getElementById('f_teacher_id').value;
  const hrs = document.getElementById('f_hours').value;
  const actName = document.getElementById('f_activity_name').value.trim();
  const startDate = document.getElementById('f_activity_date').value;
  const endDate = document.getElementById('f_activity_end_date').value;
  const loc = document.getElementById('f_location').value.trim();
  const detail = document.getElementById('f_activity_detail').value.trim();

  if (!ref12Id) {
    return safeAlert('ยังไม่ได้รับอนุมัติ กพช.1-2', 'กรุณาตรวจสอบสิทธิ์ กพช.1-2 ก่อนส่งบันทึกผลงานครับ', 'warning');
  }
  if (!sid || !sname || !lvl || !tid || !hrs || !actName || !startDate || !endDate || !detail) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * และวันที่เริ่ม-สิ้นสุดโครงการให้ครบ', 'warning');
  }
  if (endDate < startDate) {
    return safeAlert('วันที่ไม่ถูกต้อง', 'วันสิ้นสุดโครงการต้องไม่น้อยกว่าวันที่เริ่มโครงการ', 'warning');
  }
  if (compressedImages.length < 2 || compressedImages.length > 3) {
    return safeAlert('รูปภาพไม่ครบ', 'กรุณาแนบรูปภาพกิจกรรม 2 - 3 ภาพ', 'warning');
  }

  showLoading('กำลังอัปโหลดรูปภาพและบันทึกข้อมูล...');
  try {
    const res = await callApi('submitKPCH', {
      payload: {
        ref_12_id: ref12Id,
        student_id: sid, student_name: sname, level: lvl, teacher_id: tid,
        hours: hrs, activity_name: actName, activity_date: startDate,
        activity_end_date: endDate, location: loc, activity_detail: detail,
        images: compressedImages
      }
    });
    hideLoading();
    safeAlert('ส่งบันทึก กพช. สำเร็จ! 🎉', `รหัสคำขอของคุณคือ <b class="text-primary">${esc(res.req_id)}</b><br>เรื่องถูกส่งไปยังครูประจำกลุ่มเรียบร้อยแล้ว`, 'success');
    ['f_student_id','f_student_name','f_level','f_teacher_id','f_hours','f_activity_name','f_activity_date','f_activity_end_date','f_location','f_activity_detail','f_images'].forEach(id => {
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

async function searchMyStatus() {
  const sid = document.getElementById('searchStudentId').value.trim();
  if (!sid) return safeAlert('แจ้งเตือน', 'กรุณากรอกรหัสนักศึกษา', 'warning');
  showLoading('กำลังค้นหาข้อมูล...');
  try {
    const res = await callApi('checkStatus', { student_id: sid });
    hideLoading();
    const list12 = res.approvals12 || [];
    const listSubs = res.submissions || [];
    const area = document.getElementById('statusResultArea');

    if (list12.length === 0 && listSubs.length === 0) {
      area.innerHTML = `
        <div class="alert alert-warning rounded-4 text-center">
          <div class="fw-bold mb-1">❌ ยังไม่พบประวัติการขออนุมัติทำ กพช. (กพช.1-2) ของรหัสนักศึกษา ${esc(sid)}</div>
          <div class="small mb-2">นักศึกษาต้องยื่นขออนุมัติ กพช.1-2 ก่อนลงมือทำกิจกรรมนะครับ</div>
          <button type="button" class="btn btn-primary btn-sm rounded-pill fw-bold" onclick="goToPre12WithId('${esc(sid)}')">📋 ไปยื่นขอ กพช.1-2 ตอนนี้</button>
        </div>
      `;
      return;
    }

    let html = '<h6 class="fw-bold text-primary mb-2">📋 1. สถานะคำขออนุมัติทำ กพช. (กพช.1-2)</h6>';
    if (list12.length === 0) {
      html += '<div class="alert alert-secondary small rounded-3">ยังไม่มีรายการขอ กพช.1-2</div>';
    } else {
      html += list12.map(r => {
        const st = STEP12_LABELS[r.status_12] || { text: r.status_12, cls: 'bg-secondary' };
        return `
          <div class="mobile-item-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <span class="badge bg-light text-primary border me-1">${esc(r.req12_id)}</span>
                <strong>${esc(r.activity_name)}</strong>
                <div class="small text-muted mt-1">
                  ผู้ขอ: ${esc(r.student_name)} | ครู: ${esc(r.teacher_name)} | ภาคเรียน: ${esc(formatTermText(r.term))} | จำนวน: <b>${esc(r.hours)} ชม.</b><br>
                  แผนวันที่: ${formatShortThaiDate(r.plan_start_date)} ถึง ${formatShortThaiDate(r.plan_end_date)}
                </div>
              </div>
              <span class="badge step-badge ${st.cls}">${st.text}</span>
            </div>
            ${r.status_12 === 'APPROVED_12' ? `<div class="small text-success fw-semibold mt-2">✅ อนุมัติเมื่อ: ${esc(r.approved_at_12)} — สามารถไปส่งผลงานที่แท็บ "2. ส่งบันทึกผล กพช." ได้เลย</div>` : ''}
            ${r.status_12 === 'REJECTED_12' ? `<div class="alert alert-danger mt-2 mb-0 py-2 small rounded-3"><b>เหตุผลที่ไม่ผ่าน:</b> ${esc(r.reject_reason_12)}</div>` : ''}
          </div>
        `;
      }).join('');
    }

    html += '<h6 class="fw-bold text-primary mt-4 mb-2">📸 2. สถานะการส่งบันทึกผลงาน กพช. (หลังทำเสร็จ)</h6>';
    if (listSubs.length === 0) {
      html += '<div class="alert alert-light border small rounded-3">ยังไม่มีการส่งบันทึกผลงานพร้อมรูปภาพ</div>';
    } else {
      html += listSubs.map(r => {
        const st = STEP_LABELS[r.current_step] || { text: r.current_step, cls: 'bg-secondary' };
        const steps = [
          { label: 'ครูประจำกลุ่ม', done: !!r.teacher_approved_at },
          { label: 'กรรมการ1', done: !!r.comm1_approved_at },
          { label: 'กรรมการ2', done: !!r.comm2_approved_at },
          { label: 'กรรมการ3', done: !!r.comm3_approved_at },
          { label: 'ผู้อำนวยการ', done: !!r.director_approved_at },
          { label: 'นายทะเบียน', done: r.current_step === 'COMPLETED' }
        ];
        const progHtml = steps.map(s => `
          <div class="prog-step ${s.done ? 'done' : (r.current_step === 'REJECTED' ? 'rejected' : '')}">
            <div>${s.done ? '✅' : (r.current_step === 'REJECTED' ? '❌' : '⏳')}</div>
            <div>${s.label}</div>
          </div>
        `).join('');

        return `
          <div class="mobile-item-card">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <span class="badge bg-light text-primary border me-1">${esc(r.req_id)}</span>
                ${r.ref_12_id ? `<span class="badge bg-light text-secondary border me-1">อ้างอิง ${esc(r.ref_12_id)}</span>` : ''}
                <strong>${esc(r.activity_name)}</strong>
                <div class="small text-muted mt-1">
                  ผู้ส่ง: ${esc(r.student_name)} | ครูประจำกลุ่ม: ${esc(r.teacher_name)} | จำนวน: <b>${esc(r.hours)} ชม.</b><br>
                  ช่วงวันที่: ${formatShortThaiDate(r.activity_date)} ถึง ${formatShortThaiDate(r.activity_end_date)}
                </div>
              </div>
              <span class="badge step-badge ${st.cls}">${st.text}</span>
            </div>
            <div class="cute-progress-bar">${progHtml}</div>
            ${r.current_step === 'REJECTED' ? `<div class="alert alert-danger mt-2 mb-0 py-2 small rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(r.reject_reason)}</div>` : ''}
          </div>
        `;
      }).join('');
    }
    area.innerHTML = html;
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== ล็อคอิน / หลังบ้าน ====================
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
    await loadDashboard();
  } catch (err) {
    hideLoading();
    safeAlert('เข้าสู่ระบบไม่สำเร็จ', err.message, 'error');
  }
}

function handleLogout() {
  if (authToken) callApi('logout', { token: authToken }).catch(() => {});
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem('kpch_token');
  document.getElementById('dashboardSection').classList.add('d-none');
  document.getElementById('publicSection').classList.remove('d-none');

  document.getElementById('dashSubmissionsView').classList.remove('d-none');
  document.getElementById('dash12View').classList.add('d-none');
  document.getElementById('adminUsersView').classList.add('d-none');
  document.getElementById('adminAnnView').classList.add('d-none');
  document.getElementById('adminLogsView').classList.add('d-none');
  document.querySelectorAll('#adminNavTabs button, #teacherNavTabs button').forEach((b, idx) => b.classList.toggle('active', idx === 0));

  renderNavbar();
  loadPublicData();
}

async function loadDashboard(silentOnExpire = false) {
  showLoading('กำลังโหลดข้อมูลหลังบ้าน...');
  try {
    const res = await callApi('getDashboard', { token: authToken });
    hideLoading();
    currentUser = res.user;
    dashItems = res.items || [];
    dash12Items = res.items12 || [];
    registrarName = res.registrar_name || '';
    adminUsers = res.users || [];
    adminLogs = res.logs || [];

    document.getElementById('publicSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    renderNavbar();

    document.getElementById('dashTitle').innerText = `หลังบ้าน: ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
    document.getElementById('dashSubtitle').innerText = `สวัสดีคุณ ${currentUser.full_name} (${currentUser.group_name || '-'})`;

    const isAdmin = currentUser.role === 'ADMIN';
    const isTeacher = currentUser.role === 'TEACHER';
    const isReg = currentUser.role === 'REGISTRAR';
    const canBatchApproveSub = ['TEACHER', 'COMM_1', 'COMM_2', 'COMM_3', 'DIRECTOR'].includes(currentUser.role);
    const canBatchMemo = ['TEACHER', 'DIRECTOR', 'REGISTRAR', 'ADMIN'].includes(currentUser.role);
    const canCheckSub = canBatchApproveSub || canBatchMemo;

    document.getElementById('adminNavTabs').classList.toggle('d-none', !isAdmin);
    document.getElementById('teacherNavTabs').classList.toggle('d-none', !isTeacher);
    document.getElementById('registrarTools').classList.toggle('d-none', !isReg);
    document.getElementById('batchApproveSubBar').classList.toggle('d-none', !canBatchApproveSub);
    document.getElementById('batchMemoBar').classList.toggle('d-none', !canBatchMemo);
    document.getElementById('thCheckbox').classList.toggle('d-none', !canCheckSub);
    document.getElementById('mobileCheckAllSubWrap').classList.toggle('d-none', !canCheckSub);

    if (isTeacher) {
      const waitSub = dashItems.filter(x => x.current_step === 'WAIT_TEACHER').length;
      const wait12 = dash12Items.filter(x => x.status_12 === 'WAIT_TEACHER_12').length;
      const bSub = document.getElementById('badgeWaitSub');
      const b12 = document.getElementById('badgeWait12');
      bSub.innerText = waitSub; bSub.classList.toggle('d-none', waitSub === 0);
      b12.innerText = wait12; b12.classList.toggle('d-none', wait12 === 0);
    }

    if (!isAdmin && !isTeacher) {
      document.getElementById('dashSubmissionsView').classList.remove('d-none');
      document.getElementById('dash12View').classList.add('d-none');
      document.getElementById('adminUsersView').classList.add('d-none');
      document.getElementById('adminAnnView').classList.add('d-none');
      document.getElementById('adminLogsView').classList.add('d-none');
    } else if (isAdmin) {
      renderAdminUsers();
      renderAdminLogs();
      if (res.announcement) {
        document.getElementById('ann_visible').checked = !!res.announcement.visible;
        document.getElementById('ann_badge').value = res.announcement.badge || '';
        document.getElementById('ann_content').value = res.announcement.content || '';
      }
    }
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
  document.querySelectorAll('#teacherNavTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dashSubmissionsView').classList.toggle('d-none', tab !== 'sub');
  document.getElementById('dash12View').classList.toggle('d-none', tab !== 'req12');
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

// ==================== ตาราง กพช.1-2 + อนุมัติหลายรายการ ====================
function toggleAll12Checks(master) {
  document.querySelectorAll('.chk-12').forEach(cb => cb.checked = master.checked);
}

function render12List() {
  const kw = document.getElementById('dash12SearchInput').value.toLowerCase().trim();
  const filtered = dash12Items.filter(item => {
    if (filter12Mode === 'PENDING' && item.status_12 !== 'WAIT_TEACHER_12') return false;
    if (kw) {
      const text = `${item.req12_id} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('dash12TableBody');
  const mobileBox = document.getElementById('dash12MobileCards');
  const masterCb = document.getElementById('checkAll12Box');
  if (masterCb) masterCb.checked = false;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">ไม่มีคำขอ กพช.1-2 ในหมวดหมู่นี้</td></tr>`;
    mobileBox.innerHTML = `<div class="text-center py-4 text-muted">ไม่มีคำขอ กพช.1-2 ในหมวดหมู่นี้</div>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const st = STEP12_LABELS[item.status_12] || { text: item.status_12, cls: 'bg-secondary' };
    const canAct = item.status_12 === 'WAIT_TEACHER_12';
    return `
      <tr>
        <td>${canAct ? `<input type="checkbox" class="chk-12" value="${esc(item.req12_id)}">` : ''}</td>
        <td>
          <div class="fw-bold text-primary">${esc(item.req12_id)}</div>
          <div class="small text-muted">${esc(item.created_at)}</div>
        </td>
        <td>
          <div class="fw-semibold">${esc(item.student_name)}</div>
          <div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div>
        </td>
        <td class="small">${esc(formatTermText(item.term))}</td>
        <td>
          <div class="fw-semibold">${esc(item.activity_name)}</div>
          <div class="small text-muted">${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)} | <b>${esc(item.hours)} ชม.</b></div>
        </td>
        <td><span class="badge step-badge ${st.cls}">${st.text}</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-outline-primary btn-sm rounded-pill" onclick="open12DetailModal('${esc(item.req12_id)}')">
            <i class="bi bi-eye"></i> ${canAct ? 'ตรวจ/อนุมัติ' : 'ดูแผน'}
          </button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill ms-1" onclick="printForm12('${esc(item.req12_id)}')">
            <i class="bi bi-printer"></i> กพช.1-2
          </button>
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
          <div>
            ${canAct ? `<input type="checkbox" class="chk-12 me-2" value="${esc(item.req12_id)}">` : ''}
            <span class="fw-bold text-primary">${esc(item.req12_id)}</span>
          </div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-3">
          <b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)}) | <b>ภาค:</b> ${esc(formatTermText(item.term))}<br>
          <b>แผนวันที่:</b> ${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)} | <b>${esc(item.hours)} ชม.</b>
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm rounded-pill flex-fill fw-bold" onclick="open12DetailModal('${esc(item.req12_id)}')">
            <i class="bi bi-eye me-1"></i>${canAct ? 'ดูแผน / อนุมัติ' : 'ดูรายละเอียด'}
          </button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="printForm12('${esc(item.req12_id)}')">
            <i class="bi bi-printer"></i> กพช.1-2
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function confirmBatchApprove12() {
  const ids = Array.from(new Set(Array.from(document.querySelectorAll('.chk-12:checked')).map(cb => cb.value)));
  if (ids.length === 0) {
    return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการ กพช.1-2 ที่รออนุมัติอย่างน้อย 1 รายการครับ', 'warning');
  }
  Swal.fire({
    title: `อนุมัติ กพช.1-2 จำนวน ${ids.length} รายการ?`,
    text: 'นักศึกษาที่เลือกทั้งหมดจะได้รับอนุญาตให้ดำเนินกิจกรรมและส่งผลงานได้ทันที',
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยันอนุมัติทั้งหมด', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading(`กำลังอนุมัติ กพช.1-2 (${ids.length} รายการ)...`);
      try {
        const r = await callApi('batchApprove12', { token: authToken, req12_ids: ids });
        hideLoading();
        safeAlert('สำเร็จ 🎉', `อนุมัติ กพช.1-2 เรียบร้อยแล้ว ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) {
        hideLoading();
        safeAlert('ผิดพลาด', err.message, 'error');
      }
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
      <div class="col-12 col-md-6"><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</div>
      <div class="col-12 col-md-6"><b>กลุ่ม/ศูนย์การเรียน:</b> ${esc(item.group_name || '-')}</div>
      <div class="col-12 col-md-6"><b>ช่วงเวลาตามแผน:</b> ${formatShortThaiDate(item.plan_start_date)} ถึง ${formatShortThaiDate(item.plan_end_date)} (${esc(item.hours)} ชม.)</div>
      <div class="col-12 col-md-6"><b>สถานที่:</b> ${esc(item.location || '-')}</div>
    </div>
    <h6 class="fw-bold">ชื่อกิจกรรม / โครงการที่จะทำ:</h6>
    <p>${esc(item.activity_name)}</p>
    <h6 class="fw-bold">วัตถุประสงค์ / แผนการดำเนินกิจกรรม:</h6>
    <p style="white-space: pre-line;" class="border p-3 rounded-3 bg-white">${esc(item.plan_detail)}</p>
    <h6 class="fw-bold mt-3">ผลประเมินตนเอง (กพช. 2) ทั้ง 10 ข้อ:</h6>
    <div class="table-responsive mb-2">
      <table class="table table-bordered table-sm small mb-0">
        <thead class="table-light"><tr><th style="width:40px;">ที่</th><th>รายการ</th><th style="width:85px;" class="text-center">ระดับ</th></tr></thead>
        <tbody>${scorePreview}</tbody>
      </table>
    </div>
    ${item.approved_at_12 ? `<div class="small text-success fw-bold">✅ อนุมัติให้ทำกิจกรรมเมื่อ: ${esc(item.approved_at_12)}</div>` : ''}
    ${item.reject_reason_12 ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ไม่ผ่าน:</b> ${esc(item.reject_reason_12)}</div>` : ''}
  `;

  const canAct = item.status_12 === 'WAIT_TEACHER_12' && ['TEACHER', 'ADMIN'].includes(currentUser.role);
  document.getElementById('detailModalFooter').innerHTML = `
    <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="printForm12('${esc(item.req12_id)}')">
      <i class="bi bi-printer me-1"></i>พิมพ์ กพช.1 และ กพช.2 (PDF)
    </button>
    <div class="d-flex flex-wrap gap-2">
      ${canAct ? `
        <button type="button" class="btn btn-danger rounded-pill px-3 fw-bold" onclick="submitDecision12('${esc(item.req12_id)}', 'REJECT')">
          <i class="bi bi-x-circle me-1"></i>ไม่อนุมัติ
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
  if (decision === 'APPROVE') {
    Swal.fire({
      title: 'อนุมัติคำขอ กพช.1-2?',
      text: `อนุญาตให้นักศึกษาดำเนินกิจกรรมตามคำขอ ${req12Id} ใช่หรือไม่`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'ยืนยันอนุมัติ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
    }).then(res => { if (res.isConfirmed) executeApproval12(req12Id, 'APPROVE', ''); });
  } else {
    Swal.fire({
      title: 'ระบุเหตุผลที่ไม่ผ่าน / ให้แก้ไข กพช.1-2', input: 'textarea',
      inputPlaceholder: 'เช่น แผนกิจกรรมยังไม่ชัดเจน กรุณาปรับแก้ไข...',
      showCancelButton: true, confirmButtonText: 'ส่งคืนแก้ไข', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444',
      inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; }
    }).then(res => { if (res.isConfirmed) executeApproval12(req12Id, 'REJECT', res.value); });
  }
}

async function executeApproval12(req12Id, decision, reason) {
  showLoading('กำลังบันทึกผล กพช.1-2...');
  try {
    await callApi('processApproval12', { token: authToken, req12_id: req12Id, decision, reason });
    hideLoading();
    closeModalById('detailModal');
    safeAlert('สำเร็จ', 'บันทึกผลการพิจารณา กพช.1-2 เรียบร้อยแล้ว', 'success');
    await loadDashboard();
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== พิมพ์ กพช. 1 (หน้า 1) และ กพช. 2 (หน้า 2) ====================
function printForm12(req12Id) {
  const item = dash12Items.find(x => x.req12_id === req12Id);
  if (!item) return;

  const nameParts = (item.student_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '-';

  const termObj = parseTermParts(item.term);
  const blankDateLine = '........./................../................';
  const regNameDisplay = registrarName ? esc(registrarName) : '...........................................';

  let scores = [];
  try { scores = JSON.parse(item.eval_scores || '[]'); } catch (e) {}

  const evalRowsHtml = EVAL_QUESTIONS_12.map((q, i) => {
    const val = scores[i] || '';
    return `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${q}</td>
        <td style="text-align:center; font-weight:bold;">${val === 'มาก' ? '✓' : ''}</td>
        <td style="text-align:center; font-weight:bold;">${val === 'ปานกลาง' ? '✓' : ''}</td>
        <td style="text-align:center; font-weight:bold;">${val === 'น้อย' ? '✓' : ''}</td>
        <td></td>
      </tr>
    `;
  }).join('');

  const passChecked = item.status_12 !== 'REJECTED_12';
  const rejectChecked = item.status_12 === 'REJECTED_12';

  document.getElementById('printOnlyContainer').innerHTML = `
    <!-- หน้าที่ 1: แบบ กพช. 1 (ใช้จุดไข่ปลาทั้งหมด ไม่ใช้ขีดล่าง) -->
    <div class="memo-page" style="padding: 10px 12px; line-height: 1.85; font-size: 16pt;">
      <div style="text-align:right; font-weight:bold; margin-bottom:14px;">กพช. 1</div>

      <div style="text-align:center; font-weight:bold; font-size:18pt; margin-bottom:8px;">
        แบบลงทะเบียนกิจกรรมพัฒนาคุณภาพชีวิต (รายบุคคล)
      </div>
      <div style="text-align:center; margin-bottom:4px;">
        <b>สถานศึกษา</b> ${dotVal(SCHOOL_NAME, 6)}
      </div>
      <div style="text-align:center; margin-bottom:26px;">
        <b>ภาคเรียนที่</b> ${dotVal(termObj.no, 4)}/${dotVal(termObj.year, 5)}
      </div>

      <div style="display:flex; justify-content:space-between; white-space:nowrap; gap:8px; margin-bottom:14px;">
        <span>ชื่อ ${dotVal(firstName, 4)}</span>
        <span>สกุล ${dotVal(lastName, 4)}</span>
        <span>รหัสประจำตัวนักศึกษา ${dotVal(item.student_id, 4)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; white-space:nowrap; gap:12px; margin-bottom:14px;">
        <span>ระดับ ${dotVal(item.level, 5)}</span>
        <span>กลุ่ม/กศน.ตำบล ${dotVal(item.group_name || '-', 7)}</span>
      </div>
      <div style="margin-bottom:44px;">
        ครูรับผิดชอบ ${dotVal(item.teacher_name, 10)}
      </div>

      <div style="text-align:center; margin-bottom:70px;">
        <span style="white-space:nowrap;">ลงชื่อ.....................................................นักศึกษา</span><br>
        ( ${esc(item.student_name)} )<br>
        ${blankDateLine}
      </div>

      <div style="display:flex; justify-content:space-between; text-align:center; margin-top:40px; page-break-inside:avoid;">
        <div style="width:48%;">
          <span style="white-space:nowrap;">ลงชื่อ..........................................ผู้รับลงทะเบียน</span><br>
          ( ${esc(item.teacher_name)} )<br>
          ${blankDateLine}
        </div>
        <div style="width:48%;">
          <span style="white-space:nowrap;">ลงชื่อ..........................................นายทะเบียน</span><br>
          ( ${regNameDisplay} )<br>
          ${blankDateLine}
        </div>
      </div>
      <div style="margin-top:55px; font-size:12pt; color:#555; text-align:right;">
        รหัสอ้างอิงระบบออนไลน์: ${esc(item.req12_id)}
      </div>
    </div>

    <!-- หน้าที่ 2: แบบ กพช. 2 (ติ๊กผ่านอัตโนมัติ + ใช้จุดไข่ปลาทั้งหมด) -->
    <div style="padding: 4px 8px; line-height: 1.4;">
      <div style="text-align:right; font-weight:bold; font-size:15pt;">กพช. 2</div>
      <div style="text-align:center; font-weight:bold; font-size:17pt; margin-bottom:6px;">
        แบบประเมินตนเองกิจกรรมพัฒนาคุณภาพชีวิต
      </div>

      <div style="font-weight:bold; font-size:15pt; margin-bottom:4px;">ส่วนที่ 1 สำหรับผู้เรียน</div>
      <div style="font-size:14.5pt; margin-bottom:8px; line-height:1.55;">
        <div>ชื่อสถานศึกษา ${dotVal(SCHOOL_NAME, 12)}</div>
        <div style="display:flex; justify-content:space-between; white-space:nowrap; gap:10px;">
          <span>ชื่อ-สกุล ${dotVal(item.student_name, 6)}</span>
          <span>รหัสประจำตัวนักศึกษา ${dotVal(item.student_id, 5)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; white-space:nowrap; gap:10px;">
          <span>ระดับการศึกษา ${dotVal(item.level, 5)}</span>
          <span>ศูนย์การเรียน ${dotVal(item.group_name || '-', 6)}</span>
        </div>
        <div>ครูผู้รับผิดชอบ ${dotVal(item.teacher_name, 14)}</div>
      </div>

      <table class="batch-table" style="font-size:13.5pt !important; margin-top:4px;">
        <thead>
          <tr>
            <th rowspan="2" style="width:5%; vertical-align:middle;">ที่</th>
            <th rowspan="2" style="width:57%; vertical-align:middle;">รายการ</th>
            <th colspan="3" style="width:26%;">ระดับความรู้ความเข้าใจ</th>
            <th rowspan="2" style="width:12%; vertical-align:middle;">หมายเหตุ</th>
          </tr>
          <tr>
            <th style="width:8%;">มาก</th>
            <th style="width:10%;">ปานกลาง</th>
            <th style="width:8%;">น้อย</th>
          </tr>
        </thead>
        <tbody>
          ${evalRowsHtml}
        </tbody>
      </table>

      <div style="text-align:center; margin-top:12px; margin-bottom:12px; font-size:15pt;">
        <span style="white-space:nowrap;">ลงชื่อ...............................................ผู้เรียน</span><br>
        ( ${esc(item.student_name)} )
      </div>

      <div style="font-size:15pt; margin-bottom:16px; page-break-inside:avoid;">
        <b>ส่วนที่ 2 สำหรับสถานศึกษา</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <span style="display:inline-block; width:16px; height:16px; border:1px solid #000; text-align:center; line-height:15px; vertical-align:middle; font-weight:bold;">${passChecked ? '✓' : '&nbsp;'}</span> ผ่าน
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <span style="display:inline-block; width:16px; height:16px; border:1px solid #000; text-align:center; line-height:15px; vertical-align:middle; font-weight:bold;">${rejectChecked ? '✓' : '&nbsp;'}</span> เพิ่มเติมในเรื่อง ${rejectChecked ? esc(item.reject_reason_12) : '................................................'}
      </div>

      <div style="text-align:center; font-size:15pt; page-break-inside:avoid;">
        <span style="white-space:nowrap;">ลงชื่อ...............................................ครูผู้รับผิดชอบ</span><br>
        ( ${esc(item.teacher_name)} )
      </div>
    </div>
  `;
  setTimeout(() => window.print(), 400);
}

// ==================== ตารางส่งผลงาน กพช. (6 ขั้นตอน) + อนุมัติหลายรายการ ====================
function toggleAllChecks(master) {
  document.querySelectorAll('.reg-check').forEach(cb => cb.checked = master.checked);
}

function renderDashboardList() {
  const kw = document.getElementById('dashSearchInput').value.toLowerCase().trim();
  const canCheck = ['TEACHER', 'COMM_1', 'COMM_2', 'COMM_3', 'DIRECTOR', 'REGISTRAR', 'ADMIN'].includes(currentUser.role);

  const filtered = dashItems.filter(item => {
    if (filterMode === 'PENDING' && !isMyPendingItem(item)) return false;
    if (kw) {
      const text = `${item.req_id} ${item.ref_12_id || ''} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });

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
    const canAct = isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
    return `
      <tr>
        ${canCheck ? `<td><input type="checkbox" class="reg-check" value="${esc(item.req_id)}"></td>` : ''}
        <td>
          <div class="fw-bold text-primary">${esc(item.req_id)}</div>
          ${item.ref_12_id ? `<div class="small text-success">กพช.1-2: ${esc(item.ref_12_id)}</div>` : ''}
          <div class="small text-muted">${esc(item.created_at)}</div>
        </td>
        <td>
          <div class="fw-semibold">${esc(item.student_name)}</div>
          <div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div>
        </td>
        <td class="small">${esc(item.teacher_name)}</td>
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
        </td>
      </tr>
    `;
  }).join('');

  mobileBox.innerHTML = filtered.map(item => {
    const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
    const canAct = isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
    return `
      <div class="mobile-item-card">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            ${canCheck ? `<input type="checkbox" class="reg-check me-2" value="${esc(item.req_id)}">` : ''}
            <span class="fw-bold text-primary">${esc(item.req_id)}</span>
          </div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-3">
          <b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)})<br>
          <b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)} | <b>ชั่วโมง:</b> ${esc(item.hours)} ชม.<br>
          <b>วันที่:</b> ${formatShortThaiDate(item.activity_date)} ถึง ${formatShortThaiDate(item.activity_end_date)}
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm rounded-pill flex-fill fw-bold" onclick="openDetailModal('${esc(item.req_id)}')">
            <i class="bi bi-eye me-1"></i>${canAct ? 'ดูรูป / อนุมัติ' : 'ดูรายละเอียด'}
          </button>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-3" onclick="printProjectPDF('${esc(item.req_id)}')">
            <i class="bi bi-printer"></i> โครงการ
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function confirmBatchApproveSub() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const validIds = checkedIds.filter(id => {
    const it = dashItems.find(x => x.req_id === id);
    return it && isMyPendingItem(it);
  });

  if (validIds.length === 0) {
    return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่อยู่ในขั้นตอน "รอดำเนินการ" ของคุณอย่างน้อย 1 รายการครับ', 'warning');
  }

  Swal.fire({
    title: `อนุมัติและส่งต่อ ${validIds.length} รายการ?`,
    text: 'รายการที่เลือกทั้งหมดจะถูกอนุมัติและส่งต่อไปยังขั้นตอนถัดไปทันที',
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยันอนุมัติทั้งหมด', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading(`กำลังอนุมัติผลงาน (${validIds.length} รายการ)...`);
      try {
        const r = await callApi('batchApproveSubmissions', { token: authToken, req_ids: validIds });
        hideLoading();
        safeAlert('สำเร็จ 🎉', `อนุมัติและส่งต่อเรียบร้อยแล้ว ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) {
        hideLoading();
        safeAlert('ผิดพลาด', err.message, 'error');
      }
    }
  });
}

function openDetailModal(reqId) {
  const item = dashItems.find(x => x.req_id === reqId);
  if (!item) return;

  document.getElementById('mdReqId').innerText = item.req_id;
  const imgs = [item.img_1, item.img_2, item.img_3].filter(Boolean);
  const imgsHtml = imgs.map((url, idx) => `
    <div class="col-6 col-md-4">
      <a href="${esc(url)}" target="_blank">
        <img src="${getDriveThumb(url)}" class="img-fluid rounded-3 border" style="height:140px; width:100%; object-fit:cover;">
      </a>
      <div class="text-center small text-muted mt-1">ภาพที่ ${idx + 1}</div>
    </div>
  `).join('');

  const st = STEP_LABELS[item.current_step] || { text: item.current_step, cls: 'bg-secondary' };
  document.getElementById('detailModalBody').innerHTML = `
    <div class="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div>
        <span class="badge step-badge ${st.cls}">${st.text}</span>
        ${item.ref_12_id ? `<span class="badge bg-success bg-opacity-10 text-success border border-success ms-1">ผ่าน กพช.1-2: ${esc(item.ref_12_id)}</span>` : ''}
      </div>
      <span class="text-muted small">ส่งเมื่อ: ${esc(item.created_at)}</span>
    </div>
    <div class="row g-2 mb-3 bg-light p-3 rounded-3 small">
      <div class="col-12 col-md-6"><b>นักศึกษา:</b> ${esc(item.student_name)} (${esc(item.student_id)})</div>
      <div class="col-12 col-md-6"><b>ระดับชั้น:</b> ${esc(item.level)}</div>
      <div class="col-12 col-md-6"><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</div>
      <div class="col-12 col-md-6"><b>จำนวนชั่วโมงที่ขอ:</b> ${esc(item.hours)} ชั่วโมง</div>
      <div class="col-12 col-md-6"><b>วันเริ่ม - สิ้นสุด:</b> ${formatShortThaiDate(item.activity_date)} ถึง ${formatShortThaiDate(item.activity_end_date)}</div>
      <div class="col-12 col-md-6"><b>สถานที่:</b> ${esc(item.location || '-')}</div>
    </div>
    <h6 class="fw-bold">ชื่อกิจกรรม/โครงการ:</h6>
    <p>${esc(item.activity_name)}</p>
    <h6 class="fw-bold">รายละเอียดการปฏิบัติกิจกรรม:</h6>
    <p style="white-space: pre-line;" class="border p-3 rounded-3 bg-white">${esc(item.activity_detail)}</p>
    <h6 class="fw-bold mt-3">ภาพถ่ายกิจกรรม (แตะเพื่อดูขนาดเต็ม):</h6>
    <div class="row g-2 mb-3">${imgsHtml}</div>
    <hr>
    <div class="small text-muted">
      <b>ประวัติการอนุมัติ:</b><br>
      ครูประจำกลุ่ม: ${esc(item.teacher_approved_at || '-')} | กก.1: ${esc(item.comm1_approved_at || '-')} | กก.2: ${esc(item.comm2_approved_at || '-')} | กก.3: ${esc(item.comm3_approved_at || '-')} | ผอ.: ${esc(item.director_approved_at || '-')}
    </div>
    ${item.reject_reason ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(item.reject_reason)}</div>` : ''}
  `;

  const canAct = isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
  document.getElementById('detailModalFooter').innerHTML = `
    <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="printProjectPDF('${esc(item.req_id)}')">
      <i class="bi bi-printer me-1"></i>พิมพ์บันทึกข้อความ + โครงการ (PDF)
    </button>
    <div class="d-flex flex-wrap gap-2">
      ${canAct ? `
        <button type="button" class="btn btn-danger rounded-pill px-3 fw-bold" onclick="submitDecision('${esc(item.req_id)}', 'REJECT')">
          <i class="bi bi-x-circle me-1"></i>ตีกลับ
        </button>
        <button type="button" class="btn btn-success rounded-pill px-3 fw-bold" onclick="submitDecision('${esc(item.req_id)}', 'APPROVE')">
          <i class="bi bi-check-circle me-1"></i>อนุมัติส่งต่อ
        </button>
      ` : ''}
      <button type="button" class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">ปิด</button>
    </div>
  `;
  openModalById('detailModal');
}

function submitDecision(reqId, decision) {
  if (decision === 'APPROVE') {
    Swal.fire({
      title: 'ยืนยันการอนุมัติ?',
      text: `ต้องการอนุมัติคำขอ ${reqId} เพื่อส่งต่อไปยังขั้นตอนถัดไปใช่หรือไม่`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'ยืนยันอนุมัติ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#10b981'
    }).then(res => { if (res.isConfirmed) executeApproval(reqId, 'APPROVE', ''); });
  } else {
    Swal.fire({
      title: 'ระบุเหตุผลในการตีกลับ', input: 'textarea',
      inputPlaceholder: 'เช่น รูปภาพไม่ชัดเจน กรุณาส่งใหม่...',
      showCancelButton: true, confirmButtonText: 'ส่งตีกลับ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444',
      inputValidator: val => { if (!val || !val.trim()) return 'กรุณาระบุเหตุผลด้วยครับ'; }
    }).then(res => { if (res.isConfirmed) executeApproval(reqId, 'REJECT', res.value); });
  }
}

async function executeApproval(reqId, decision, reason) {
  showLoading('กำลังบันทึกผลการพิจารณา...');
  try {
    await callApi('processApproval', { token: authToken, req_id: reqId, decision, reason });
    hideLoading();
    closeModalById('detailModal');
    safeAlert('สำเร็จ', 'บันทึกผลและส่งต่อข้อมูลเรียบร้อยแล้ว', 'success');
    await loadDashboard();
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== แบบที่ 1: พิมพ์บันทึกข้อความรายโครงการ + ภาพประกอบ ====================
async function printProjectPDF(reqId) {
  showLoading('กำลังจัดเตรียมบันทึกข้อความและรูปภาพ...');
  try {
    const data = await callApi('getSubmissionForPrint', { token: authToken, req_id: reqId });
    hideLoading();
    const item = data.item;
    const imgs = data.imagesBase64 || [];
    const imgsHtml = imgs.map((b64, i) => `
      <div style="width: 48%; text-align:center; margin-bottom:10px;">
        <img src="${b64}">
        <div style="font-size:13pt;">ภาพประกอบที่ ${i + 1}</div>
      </div>
    `).join('');
    const todayThai = formatThaiDate();
    const startThai = formatThaiDate(item.activity_date);
    const endThai = formatThaiDate(item.activity_end_date);

    document.getElementById('printOnlyContainer').innerHTML = `
      <div class="memo-page">
        <div class="memo-header">
          <img src="${GARUDA_URL}" class="memo-garuda" onerror="this.style.display='none'">
          <div class="memo-title">บันทึกข้อความ</div>
        </div>
        <div class="memo-field"><b>ส่วนราชการ</b> &nbsp;${SCHOOL_NAME}</div>
        <div class="memo-field" style="display:flex; justify-content:space-between;">
          <span><b>ที่</b> &nbsp;....................................................</span>
          <span><b>วันที่</b> &nbsp;${todayThai}</span>
        </div>
        <div class="memo-field"><b>เรื่อง</b> &nbsp;ขออนุมัติรับรองผลการทำกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) รายบุคคล</div>
        <div class="memo-divider"></div>

        <div class="memo-field" style="margin-bottom:10px;"><b>เรียน</b> &nbsp;ผู้อำนวยการ${SCHOOL_NAME}</div>

        <div class="memo-indent">
          ด้วย <b>${esc(item.student_name)}</b> รหัสนักศึกษา <b>${esc(item.student_id)}</b> ระดับชั้น <b>${esc(item.level)}</b>
          ซึ่งได้รับอนุมัติ กพช.1-2 (รหัส: ${esc(item.ref_12_id || '-')}) ได้ดำเนินการจัดทำกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) โครงการ/กิจกรรมเรื่อง <b>"${esc(item.activity_name)}"</b>
          ระหว่างวันที่ ${startThai} ถึงวันที่ ${endThai} ณ ${esc(item.location || '-')} รวมจำนวน <b>${esc(item.hours)} ชั่วโมง</b>
          และได้ยื่นบันทึกหลักฐานพร้อมภาพถ่ายประกอบผ่านระบบออนไลน์ (รหัสอ้างอิง: ${esc(item.req_id)}) เรียบร้อยแล้วนั้น
        </div>
        <div class="memo-indent">
          ในการนี้ ข้าพเจ้าในฐานะครูประจำกลุ่มได้ตรวจสอบความถูกต้องของเอกสารและหลักฐานการทำกิจกรรมเบื้องต้นแล้ว
          เห็นสมควรนำเสนอต่อคณะกรรมการพิจารณา กพช. และผู้อำนวยการสถานศึกษา เพื่อโปรดพิจารณาอนุมัติชั่วโมง กพช. ให้แก่นักศึกษาดังกล่าว ตามรายละเอียดที่แนบมาพร้อมนี้
        </div>
        <div class="memo-indent">
          จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ
        </div>

        <div style="width:60%; margin-left:auto; text-align:center; margin-top:20px;">
          ลงชื่อ......................................................<br>
          (${esc(item.teacher_name)})<br>
          ครูประจำกลุ่ม / ผู้เสนอโครงการ<br>
          <span style="font-size:13pt;">(อนุมัติระบบ: ${esc(item.teacher_approved_at || 'รอการอนุมัติ')})</span>
        </div>

        <div style="border:1px solid #000; padding:10px 14px; margin-top:20px; page-break-inside:avoid;">
          <b>ความเห็น / คำสั่งผู้อำนวยการสถานศึกษา</b><br>
          <div style="margin:6px 0 12px 20px;">
            [ &nbsp; ] อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] ไม่อนุมัติ / ปรับปรุงแก้ไข ....................................................
          </div>
          <div style="width:60%; margin-left:auto; text-align:center;">
            ลงชื่อ......................................................<br>
            (${DIRECTOR_NAME})<br>
            ผู้อำนวยการ${SCHOOL_NAME}<br>
            <span style="font-size:13pt;">(อนุมัติระบบ: ${esc(item.director_approved_at || 'รอการอนุมัติ')})</span>
          </div>
        </div>
      </div>

      <div>
        <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px;">
          <div style="font-size:18pt; font-weight:bold;">รายละเอียดกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) และหลักฐานภาพถ่าย</div>
          <div style="font-size:14pt;">${SCHOOL_NAME} | รหัสอ้างอิง: ${esc(item.req_id)} ${item.ref_12_id ? `| กพช.1-2: ${esc(item.ref_12_id)}` : ''}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:15pt;" border="1" cellpadding="4">
          <tr>
            <td style="width:50%;"><b>ชื่อ-สกุล นักศึกษา:</b> ${esc(item.student_name)}</td>
            <td style="width:50%;"><b>รหัสนักศึกษา:</b> ${esc(item.student_id)} (${esc(item.level)})</td>
          </tr>
          <tr>
            <td><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</td>
            <td><b>จำนวนชั่วโมง กพช. ที่ขอ:</b> ${esc(item.hours)} ชั่วโมง</td>
          </tr>
          <tr>
            <td><b>ระยะเวลาโครงการ:</b> ${startThai} ถึง ${endThai}</td>
            <td><b>สถานที่:</b> ${esc(item.location || '-')}</td>
          </tr>
        </table>
        <div style="margin-bottom:4px;"><b>1. ชื่อกิจกรรม / โครงการ:</b> ${esc(item.activity_name)}</div>
        <div style="margin-bottom:4px;"><b>2. รายละเอียดการปฏิบัติกิจกรรมและผลที่ได้รับ:</b></div>
        <div style="border:1px solid #000; padding:8px; min-height:60px; white-space:pre-line; margin-bottom:10px; font-size:15pt;">${esc(item.activity_detail)}</div>
        <div style="margin-bottom:6px;"><b>3. ภาพถ่ายหลักฐานการทำกิจกรรม:</b></div>
        <div class="print-img-box" style="display:flex; flex-wrap:wrap; justify-content:space-around;">${imgsHtml}</div>
        <div class="sig-grid">
          <div class="sig-box">
            ลงชื่อ................................................<br>
            ( นายเกียรติศักดิ์  หมั่นอุส่าห์ )<br>ครูศูนย์การเรียนรู้<br>
            <span style="font-size:13pt;">อนุมัติระบบ: ${esc(item.comm1_approved_at || 'รอดำเนินการ')}</span>
          </div>
          <div class="sig-box">
            ลงชื่อ................................................<br>
            ( นายไชยพัฒน์  นัยเนตร )<br>ครูศูนย์การเรียนรู้<br>
            <span style="font-size:13pt;">อนุมัติระบบ: ${esc(item.comm2_approved_at || 'รอดำเนินการ')}</span>
          </div>
          <div class="sig-box">
            ลงชื่อ................................................<br>
            ( นางสาวนิศารัตน์  ดอนปัญญาไพร )<br>ครูศูนย์การเรียนรู้<br>
            <span style="font-size:13pt;">อนุมัติระบบ: ${esc(item.comm3_approved_at || 'รอดำเนินการ')}</span>
          </div>
          <div class="sig-box">
            ลงชื่อ................................................<br>
            (${DIRECTOR_NAME})<br>ผู้อำนวยการ${SCHOOL_NAME}<br>
            <span style="font-size:13pt;">อนุมัติระบบ: ${esc(item.director_approved_at || 'รอดำเนินการ')}</span>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => window.print(), 600);
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== แบบที่ 2: พิมพ์บันทึกข้อความสรุปรวมเป็นชุด + บัญชีรายชื่อ ====================
async function printBatchMemo() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  let targetItems = [];

  if (checkedIds.length > 0) {
    targetItems = dashItems.filter(x => checkedIds.includes(x.req_id));
  } else {
    targetItems = dashItems.filter(x => x.current_step === 'APPROVED_FOR_REGISTRAR' || x.current_step === 'COMPLETED');
  }

  if (targetItems.length === 0) {
    return safeAlert(
      'ไม่พบรายการสำหรับพิมพ์สรุปรวม',
      'กรุณาติ๊กถูกหน้ารายการที่ต้องการ หรือรอให้รายการผ่านการอนุมัติจาก ผอ. ก่อนครับ',
      'info'
    );
  }

  const { value: formValues } = await Swal.fire({
    title: `จัดทำบันทึกข้อความสรุปรวม (${targetItems.length} รายการ)`,
    html: `
      <div class="text-start small">
        <label class="form-label fw-bold mb-1">ส่วนราชการ / กลุ่ม</label>
        <input id="swal_dept" class="form-control mb-2" value="${esc(currentUser.group_name ? SCHOOL_NAME + ' (' + currentUser.group_name + ')' : SCHOOL_NAME)}">
        <label class="form-label fw-bold mb-1">เลขที่หนังสือ (เว้นว่างไว้เติมปากกาได้)</label>
        <input id="swal_docno" class="form-control mb-2" placeholder="เช่น ศธ ๐๒๑๐..../....">
        <label class="form-label fw-bold mb-1">ภาคเรียน / ปีการศึกษา</label>
        <input id="swal_term" class="form-control" value="2/2569">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '🖨️ สร้างเอกสารและพิมพ์',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => ({
      dept: document.getElementById('swal_dept').value.trim() || SCHOOL_NAME,
      docNo: document.getElementById('swal_docno').value.trim() || '....................................................',
      term: document.getElementById('swal_term').value.trim() || '..../........'
    })
  });

  if (!formValues) return;

  const totalHours = targetItems.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const todayThai = formatThaiDate();

  const tableRowsHtml = targetItems.map((r, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${esc(r.req_id)}</td>
      <td>${esc(r.student_id)}</td>
      <td>${esc(r.student_name)}</td>
      <td style="text-align:center;">${esc(r.level)}</td>
      <td>${esc(r.activity_name)}</td>
      <td style="text-align:center;">${formatShortThaiDate(r.activity_date)} - ${formatShortThaiDate(r.activity_end_date)}</td>
      <td style="text-align:center;"><b>${esc(r.hours)}</b></td>
      <td>${esc(r.teacher_name)}</td>
    </tr>
  `).join('');

  document.getElementById('printOnlyContainer').innerHTML = `
    <div class="memo-page">
      <div class="memo-header">
        <img src="${GARUDA_URL}" class="memo-garuda" onerror="this.style.display='none'">
        <div class="memo-title">บันทึกข้อความ</div>
      </div>
      <div class="memo-field"><b>ส่วนราชการ</b> &nbsp;${esc(formValues.dept)}</div>
      <div class="memo-field" style="display:flex; justify-content:space-between;">
        <span><b>ที่</b> &nbsp;${esc(formValues.docNo)}</span>
        <span><b>วันที่</b> &nbsp;${todayThai}</span>
      </div>
      <div class="memo-field"><b>เรื่อง</b> &nbsp;ขออนุมัติผลการดำเนินกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) และบันทึกชั่วโมงเข้าระบบทะเบียน ประจำภาคเรียนที่ ${esc(formValues.term)}</div>
      <div class="memo-divider"></div>

      <div class="memo-field" style="margin-bottom:10px;"><b>เรียน</b> &nbsp;ผู้อำนวยการ${SCHOOL_NAME}</div>

      <div class="memo-indent">
        ตามที่${SCHOOL_NAME} ได้ดำเนินการจัดส่งและประเมินผลกิจกรรมพัฒนาคุณภาพชีวิต (กพช.) ของนักศึกษาผ่านระบบออนไลน์
        ประจำภาคเรียนที่ ${esc(formValues.term)} นั้น บัดนี้ นักศึกษาได้ส่งบันทึกหลักฐานการปฏิบัติกิจกรรมพร้อมภาพถ่ายประกอบครบถ้วนแล้ว
      </div>
      <div class="memo-indent">
        ในการนี้ ครูประจำกลุ่มและคณะกรรมการพิจารณา กพช. ได้ร่วมกันตรวจสอบหลักฐานและพิจารณาอนุมัติผลการดำเนินกิจกรรมเรียบร้อยแล้ว
        จำนวนทั้งสิ้น <b>${targetItems.length} ราย</b> รวมจำนวนชั่วโมง กพช. ทั้งหมด <b>${totalHours} ชั่วโมง</b>
        รายละเอียดปรากฏตามบัญชีรายชื่อที่แนบมาพร้อมบันทึกข้อความนี้
      </div>
      <div class="memo-indent">
        จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติรับรองผลการดำเนินกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)
        และมอบหมายงานทะเบียนดำเนินการบันทึกชั่วโมง กพช. เข้าระบบทะเบียนนักศึกษาต่อไป
      </div>

      <div style="width:60%; margin-left:auto; text-align:center; margin-top:20px;">
        ลงชื่อ......................................................<br>
        (${esc(currentUser.full_name)})<br>
        ตำแหน่ง ${ROLE_LABELS[currentUser.role] || currentUser.role}<br>
        ผู้สรุปเสนอรายงาน
      </div>

      <div style="border:1px solid #000; padding:10px 14px; margin-top:20px; page-break-inside:avoid;">
        <b>คำสั่ง / การอนุมัติผู้อำนวยการสถานศึกษา</b><br>
        <div style="margin:6px 0 12px 20px;">
          [ &nbsp; ] อนุมัติ และมอบหมายงานทะเบียนดำเนินการบันทึกชั่วโมง กพช. ต่อไป<br>
          [ &nbsp; ] ไม่อนุมัติ / อื่นๆ ....................................................................................
        </div>
        <div style="width:60%; margin-left:auto; text-align:center;">
          ลงชื่อ......................................................<br>
          (${DIRECTOR_NAME})<br>
          ผู้อำนวยการ${SCHOOL_NAME}<br>
          วันที่ ............../................../..............
        </div>
      </div>
    </div>

    <div>
      <div style="text-align:center; margin-bottom:8px;">
        <div style="font-size:17pt; font-weight:bold;">บัญชีรายชื่อนักศึกษาผู้ผ่านการพิจารณาอนุมัติกิจกรรม กพช. (ภาคเรียนที่ ${esc(formValues.term)})</div>
        <div style="font-size:14pt;">แนบท้ายบันทึกข้อความ ที่ ${esc(formValues.docNo)} ลงวันที่ ${todayThai} | ${SCHOOL_NAME}</div>
      </div>

      <table class="batch-table">
        <thead>
          <tr>
            <th style="width:4%;">ที่</th>
            <th style="width:13%;">รหัสอ้างอิง</th>
            <th style="width:10%;">รหัสนักศึกษา</th>
            <th style="width:16%;">ชื่อ-นามสกุล</th>
            <th style="width:10%;">ระดับ</th>
            <th style="width:17%;">ชื่อกิจกรรม/โครงการ</th>
            <th style="width:14%;">ช่วงวันที่จัด</th>
            <th style="width:5%;">ชม.</th>
            <th style="width:11%;">ครูประจำกลุ่ม</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          <tr>
            <td colspan="7" style="text-align:right; font-weight:bold;">รวมทั้งสิ้น (${targetItems.length} รายการ)</td>
            <td style="text-align:center; font-weight:bold;">${totalHours}</td>
            <td style="text-align:center;">ชั่วโมง</td>
          </tr>
        </tbody>
      </table>

      <div style="width:65%; margin-left:auto; text-align:center; margin-top:26px; page-break-inside:avoid; font-size:16pt;">
        ขอรับรองว่าข้อมูลรายชื่อข้างต้นถูกต้องครบถ้วน<br><br>
        <span style="white-space:nowrap;">ลงชื่อ...........................................ผู้จัดทำ</span><br>
        (${esc(currentUser.full_name)})<br>
        วันที่ ${todayThai}
      </div>
    </div>
  `;

  setTimeout(() => window.print(), 600);
}

// ==================== นายทะเบียน ====================
function exportRegistrarCSV() {
  const approved = dashItems.filter(x => x.current_step === 'APPROVED_FOR_REGISTRAR');
  if (approved.length === 0) return safeAlert('แจ้งเตือน', 'ไม่มีรายการที่รอลงทะเบียนในขณะนี้', 'info');

  const headers = ['ลำดับ', 'รหัสคำขอ', 'รหัส กพช.1-2', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'ระดับชั้น', 'ครูประจำกลุ่ม', 'ชื่อกิจกรรม', 'วันที่เริ่มโครงการ', 'วันสิ้นสุดโครงการ', 'สถานที่', 'จำนวนชั่วโมง', 'วันที่ ผอ.อนุมัติ'];
  const csvEscape = v => `"${String(v || '').replace(/"/g, '""')}"`;

  const lines = [headers.map(csvEscape).join(',')];
  approved.forEach((r, idx) => {
    lines.push([
      idx + 1, r.req_id, r.ref_12_id || '-', r.student_id, r.student_name, r.level, r.teacher_name,
      r.activity_name, formatShortThaiDate(r.activity_date), formatShortThaiDate(r.activity_end_date), r.location, r.hours, r.director_approved_at
    ].map(csvEscape).join(','));
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `รายชื่ออนุมัติ_กพช_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function confirmRegistrarComplete() {
  const checkedIds = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  const validIds = checkedIds.filter(id => {
    const it = dashItems.find(x => x.req_id === id);
    return it && it.current_step === 'APPROVED_FOR_REGISTRAR';
  });

  if (validIds.length === 0) {
    return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่มีสถานะ "ผอ.อนุมัติแล้ว (รอนายทะเบียน)" เพื่อปิดงานครับ', 'warning');
  }

  Swal.fire({
    title: `ยืนยันปิดงาน ${validIds.length} รายการ?`,
    text: 'รายการที่เลือกจะเปลี่ยนสถานะเป็น "บันทึกทะเบียนเรียบร้อย"',
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังอัปเดตสถานะ...');
      try {
        const r = await callApi('markRegistrarCompleted', { token: authToken, req_ids: validIds });
        hideLoading();
        safeAlert('เรียบร้อย', `ปิดงานสำเร็จ ${r.count} รายการ`, 'success');
        await loadDashboard();
      } catch (err) {
        hideLoading();
        safeAlert('ผิดพลาด', err.message, 'error');
      }
    }
  });
}

// ==================== แอดมิน ====================
function switchAdminTab(tab, btn) {
  document.querySelectorAll('#adminNavTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dashSubmissionsView').classList.toggle('d-none', tab !== 'subs');
  document.getElementById('dash12View').classList.toggle('d-none', tab !== 'req12');
  document.getElementById('adminUsersView').classList.toggle('d-none', tab !== 'users');
  document.getElementById('adminAnnView').classList.toggle('d-none', tab !== 'ann');
  document.getElementById('adminLogsView').classList.toggle('d-none', tab !== 'logs');
}

function renderAdminUsers() {
  document.getElementById('adminUsersBody').innerHTML = adminUsers.map(u => `
    <tr>
      <td>${esc(u.user_id)}</td>
      <td><b>${esc(u.username)}</b></td>
      <td>${esc(u.full_name)}</td>
      <td><span class="badge bg-info text-dark">${ROLE_LABELS[u.role] || u.role}</span></td>
      <td>${esc(u.group_name)}</td>
      <td><span class="badge ${u.status === 'ACTIVE' ? 'bg-success' : 'bg-danger'}">${esc(u.status)}</span></td>
      <td>
        <button type="button" class="btn btn-warning btn-sm rounded-pill" onclick="openUserModal('${esc(u.user_id)}')">
          <i class="bi bi-pencil"></i> แก้ไข
        </button>
      </td>
    </tr>
  `).join('');
}

function renderAdminLogs() {
  document.getElementById('adminLogsBody').innerHTML = adminLogs.map(l => `
    <tr>
      <td class="text-nowrap">${esc(l.timestamp)}</td>
      <td><b>${esc(l.req_id)}</b></td>
      <td>${esc(l.actor_name)}</td>
      <td>${esc(l.actor_role)}</td>
      <td><span class="badge bg-secondary">${esc(l.action)}</span></td>
      <td>${esc(l.remark)}</td>
    </tr>
  `).join('');
}

function openUserModal(userId) {
  const isEdit = !!userId;
  document.getElementById('userModalTitle').innerText = isEdit ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่';
  document.getElementById('u_username').readOnly = isEdit;
  document.getElementById('u_pass_hint').innerText = isEdit ? '(เว้นว่างหากไม่ต้องการเปลี่ยนรหัส)' : '(จำเป็นต้องกรอก)';
  document.getElementById('u_status_wrap').classList.toggle('d-none', !isEdit);

  if (isEdit) {
    const u = adminUsers.find(x => x.user_id === userId);
    document.getElementById('u_id').value = u.user_id;
    document.getElementById('u_username').value = u.username;
    document.getElementById('u_fullname').value = u.full_name;
    document.getElementById('u_role').value = u.role;
    document.getElementById('u_group').value = u.group_name;
    document.getElementById('u_status').value = u.status;
    document.getElementById('u_password').value = '';
  } else {
    document.getElementById('u_id').value = '';
    document.getElementById('u_username').value = '';
    document.getElementById('u_fullname').value = '';
    document.getElementById('u_role').value = 'TEACHER';
    document.getElementById('u_group').value = '';
    document.getElementById('u_password').value = '';
    document.getElementById('u_status').value = 'ACTIVE';
  }
  openModalById('userModal');
}

async function handleSaveUser() {
  const uid = document.getElementById('u_id').value;
  const uname = document.getElementById('u_username').value.trim();
  const fname = document.getElementById('u_fullname').value.trim();
  const role = document.getElementById('u_role').value;
  const group = document.getElementById('u_group').value.trim();
  const pass = document.getElementById('u_password').value;
  const status = document.getElementById('u_status').value;

  if (!uname || !fname || (!uid && !pass)) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอก Username, ชื่อ-นามสกุล และรหัสผ่านให้ครบถ้วน', 'warning');
  }

  showLoading('กำลังบันทึกข้อมูลบุคลากร...');
  try {
    await callApi('saveUserAdmin', {
      token: authToken,
      user_data: {
        user_id: uid, username: uname, full_name: fname,
        role, group_name: group, new_password: pass, status
      }
    });
    hideLoading();
    closeModalById('userModal');
    safeAlert('สำเร็จ', 'บันทึกข้อมูลบุคลากรเรียบร้อยแล้ว', 'success');
    await loadDashboard();
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

async function handleSaveAnnouncement() {
  const visible = document.getElementById('ann_visible').checked;
  const badge = document.getElementById('ann_badge').value.trim();
  const content = document.getElementById('ann_content').value.trim();

  showLoading('กำลังบันทึกข่าวประกาศ...');
  try {
    const res = await callApi('saveAnnouncement', {
      token: authToken,
      announcement: { visible, badge, content }
    });
    hideLoading();
    renderAnnouncement(res.announcement);
    safeAlert('สำเร็จ', 'อัปเดตข่าวประกาศเรียบร้อยแล้ว', 'success');
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

async function handleChangeMyPassword() {
  const oldPass = document.getElementById('cp_old').value;
  const newPass = document.getElementById('cp_new').value;
  const confirmPass = document.getElementById('cp_confirm').value;

  if (!oldPass || !newPass || !confirmPass) {
    return safeAlert('ข้อมูลไม่ครบ', 'กรุณากรอกรหัสผ่านให้ครบทุกช่อง', 'warning');
  }
  if (newPass.length < 4) {
    return safeAlert('รหัสผ่านสั้นเกินไป', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร', 'warning');
  }
  if (newPass !== confirmPass) {
    return safeAlert('รหัสผ่านไม่ตรงกัน', 'กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่านให้ตรงกัน', 'warning');
  }

  showLoading('กำลังเปลี่ยนรหัสผ่าน...');
  try {
    await callApi('changePassword', { token: authToken, old_pass: oldPass, new_pass: newPass });
    hideLoading();
    ['cp_old', 'cp_new', 'cp_confirm'].forEach(id => document.getElementById(id).value = '');
    closeModalById('changePassModal');
    safeAlert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
