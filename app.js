// ⚠️ นำลิงก์เว็บแอป (/exec) ที่ได้จากการ Deploy ใน Apps Script มาวางแทนที่ในเครื่องหมายคำพูดด้านล่างนี้
const API_URL = 'https://script.google.com/macros/s/AKfycbwuuQeFT7Ikjcr4GeTrwdY_7I4hJ-Ksgs4dWWYV1us8lOe02233vtOgv0TTyPwgM9Vu/exec';

let compressedImages = [];
let authToken = null;
let currentUser = null;
let dashItems = [];
let adminUsers = [];
let adminLogs = [];
let filterMode = 'PENDING';

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

const ROLE_LABELS = {
  'TEACHER': 'ครูประจำกลุ่ม',
  'COMM_1': 'คณะกรรมการ ท่านที่ 1',
  'COMM_2': 'คณะกรรมการ ท่านที่ 2',
  'COMM_3': 'คณะกรรมการ ท่านที่ 3',
  'DIRECTOR': 'ผู้อำนวยการ',
  'REGISTRAR': 'นายทะเบียน',
  'ADMIN': 'ผู้ดูแลระบบ (Admin)'
};

// ==================== เชื่อมต่อ API Google Apps Script ====================
async function callApi(action, params = {}) {
  if (!API_URL || API_URL.includes('วาง_URL_ของ')) {
    throw new Error('กรุณาเปิดไฟล์ app.js แล้วนำลิงก์ /exec จาก Apps Script มาวางในตัวแปร API_URL บรรทัดที่ 2 ก่อนครับ');
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

// ==================== ส่วนนักศึกษา ====================
function switchPublicTab(tab) {
  document.getElementById('tabBtnSubmit').classList.toggle('active', tab === 'submit');
  document.getElementById('tabBtnStatus').classList.toggle('active', tab === 'status');
  document.getElementById('publicSubmitView').classList.toggle('d-none', tab !== 'submit');
  document.getElementById('publicStatusView').classList.toggle('d-none', tab !== 'status');
}

async function loadTeachersDropdown() {
  const sel = document.getElementById('f_teacher_id');
  const errEl = document.getElementById('teacherLoadError');
  try {
    const list = await callApi('getTeachers');
    errEl.classList.add('d-none');
    if (!list || list.length === 0) {
      sel.innerHTML = '<option value="">-- ยังไม่มีรายชื่อครูในระบบ --</option>';
      return;
    }
    sel.innerHTML = '<option value="">-- กรุณาเลือกครูประจำกลุ่ม --</option>' +
      list.map(t => `<option value="${esc(t.user_id)}">${esc(t.full_name)} (${esc(t.group_name)})</option>`).join('');
  } catch (err) {
    sel.innerHTML = '<option value="">-- โหลดรายชื่อครูไม่สำเร็จ --</option>';
    errEl.innerText = err.message;
    errEl.classList.remove('d-none');
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
  const sname = document.getElementById('f_student_name').value.trim();
  const lvl = document.getElementById('f_level').value;
  const tid = document.getElementById('f_teacher_id').value;
  const hrs = document.getElementById('f_hours').value;
  const actName = document.getElementById('f_activity_name').value.trim();
  const startDate = document.getElementById('f_activity_date').value;
  const endDate = document.getElementById('f_activity_end_date').value;
  const loc = document.getElementById('f_location').value.trim();
  const detail = document.getElementById('f_activity_detail').value.trim();

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
    compressedImages = [];
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
    const rows = await callApi('checkStatus', { student_id: sid });
    hideLoading();
    const area = document.getElementById('statusResultArea');
    if (!rows || rows.length === 0) {
      area.innerHTML = '<div class="alert alert-secondary rounded-4 text-center">ไม่พบประวัติการส่งคำขอของรหัสนักศึกษานี้</div>';
      return;
    }
    area.innerHTML = rows.map(r => {
      const st = STEP_LABELS[r.current_step] || { text: r.current_step, cls: 'bg-secondary' };
      const steps = [
        { label: 'ครู', done: !!r.teacher_approved_at },
        { label: 'กก.1', done: !!r.comm1_approved_at },
        { label: 'กก.2', done: !!r.comm2_approved_at },
        { label: 'กก.3', done: !!r.comm3_approved_at },
        { label: 'ผอ.', done: !!r.director_approved_at },
        { label: 'ทะเบียน', done: r.current_step === 'COMPLETED' }
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
              <strong>${esc(r.activity_name)}</strong>
              <div class="small text-muted mt-1">
                ผู้ส่ง: ${esc(r.student_name)} | ครู: ${esc(r.teacher_name)} | จำนวน: <b>${esc(r.hours)} ชม.</b><br>
                ช่วงวันที่: ${esc(r.activity_date || '-')} ถึง ${esc(r.activity_end_date || '-')}
              </div>
            </div>
            <span class="badge step-badge ${st.cls}">${st.text}</span>
          </div>
          <div class="cute-progress-bar">${progHtml}</div>
          ${r.current_step === 'REJECTED' ? `<div class="alert alert-danger mt-2 mb-0 py-2 small rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(r.reject_reason)}</div>` : ''}
        </div>
      `;
    }).join('');
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
  renderNavbar();
}

async function loadDashboard(silentOnExpire = false) {
  showLoading('กำลังโหลดข้อมูลหลังบ้าน...');
  try {
    const res = await callApi('getDashboard', { token: authToken });
    hideLoading();
    currentUser = res.user;
    dashItems = res.items || [];
    adminUsers = res.users || [];
    adminLogs = res.logs || [];

    document.getElementById('publicSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    renderNavbar();

    document.getElementById('dashTitle').innerText = `หลังบ้าน: ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
    document.getElementById('dashSubtitle').innerText = `สวัสดีคุณ ${currentUser.full_name} (${currentUser.group_name || '-'})`;

    const isAdmin = currentUser.role === 'ADMIN';
    const isReg = currentUser.role === 'REGISTRAR';
    document.getElementById('adminNavTabs').classList.toggle('d-none', !isAdmin);
    document.getElementById('registrarTools').classList.toggle('d-none', !isReg);
    document.getElementById('thCheckbox').classList.toggle('d-none', !isReg);

    if (isAdmin) {
      renderAdminUsers();
      renderAdminLogs();
    }
    renderDashboardList();
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

function renderDashboardList() {
  const kw = document.getElementById('dashSearchInput').value.toLowerCase().trim();
  const isReg = currentUser.role === 'REGISTRAR';

  const filtered = dashItems.filter(item => {
    if (filterMode === 'PENDING' && !isMyPendingItem(item)) return false;
    if (kw) {
      const text = `${item.req_id} ${item.student_id} ${item.student_name} ${item.activity_name} ${item.teacher_name}`.toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('dashTableBody');
  const mobileBox = document.getElementById('dashMobileCards');

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
        ${isReg ? `<td>${item.current_step === 'APPROVED_FOR_REGISTRAR' ? `<input type="checkbox" class="reg-check" value="${esc(item.req_id)}">` : ''}</td>` : ''}
        <td>
          <div class="fw-bold text-primary">${esc(item.req_id)}</div>
          <div class="small text-muted">${esc(item.created_at)}</div>
        </td>
        <td>
          <div class="fw-semibold">${esc(item.student_name)}</div>
          <div class="small text-muted">${esc(item.student_id)} (${esc(item.level)})</div>
        </td>
        <td class="small">${esc(item.teacher_name)}</td>
        <td>
          <div class="fw-semibold">${esc(item.activity_name)}</div>
          <div class="small text-muted">${esc(item.activity_date || '-')} ถึง ${esc(item.activity_end_date || '-')} | <b>${esc(item.hours)} ชม.</b></div>
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
            ${isReg && item.current_step === 'APPROVED_FOR_REGISTRAR' ? `<input type="checkbox" class="reg-check me-2" value="${esc(item.req_id)}">` : ''}
            <span class="fw-bold text-primary">${esc(item.req_id)}</span>
          </div>
          <span class="badge step-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="fw-bold mb-1">${esc(item.activity_name)}</div>
        <div class="small text-muted mb-3">
          <b>นศ.:</b> ${esc(item.student_name)} (${esc(item.student_id)})<br>
          <b>ครู:</b> ${esc(item.teacher_name)} | <b>ชั่วโมง:</b> ${esc(item.hours)} ชม.<br>
          <b>วันที่:</b> ${esc(item.activity_date || '-')} ถึง ${esc(item.activity_end_date || '-')}
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
      <span class="badge step-badge ${st.cls}">${st.text}</span>
      <span class="text-muted small">ส่งเมื่อ: ${esc(item.created_at)}</span>
    </div>
    <div class="row g-2 mb-3 bg-light p-3 rounded-3 small">
      <div class="col-12 col-md-6"><b>นักศึกษา:</b> ${esc(item.student_name)} (${esc(item.student_id)})</div>
      <div class="col-12 col-md-6"><b>ระดับชั้น:</b> ${esc(item.level)}</div>
      <div class="col-12 col-md-6"><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</div>
      <div class="col-12 col-md-6"><b>จำนวนชั่วโมงที่ขอ:</b> ${esc(item.hours)} ชั่วโมง</div>
      <div class="col-12 col-md-6"><b>วันเริ่ม - สิ้นสุด:</b> ${esc(item.activity_date || '-')} ถึง ${esc(item.activity_end_date || '-')}</div>
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
      ครู: ${esc(item.teacher_approved_at || '-')} | กก.1: ${esc(item.comm1_approved_at || '-')} | กก.2: ${esc(item.comm2_approved_at || '-')} | กก.3: ${esc(item.comm3_approved_at || '-')} | ผอ.: ${esc(item.director_approved_at || '-')}
    </div>
    ${item.reject_reason ? `<div class="alert alert-danger mt-2 mb-0 rounded-3"><b>เหตุผลที่ตีกลับ:</b> ${esc(item.reject_reason)}</div>` : ''}
  `;

  const canAct = isMyPendingItem(item) && !['REGISTRAR', 'ADMIN'].includes(currentUser.role);
  document.getElementById('detailModalFooter').innerHTML = `
    <button type="button" class="btn btn-dark btn-sm rounded-pill px-3" onclick="printProjectPDF('${esc(item.req_id)}')">
      <i class="bi bi-printer me-1"></i>พิมพ์ / โหลดโครงการ (PDF)
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

async function printProjectPDF(reqId) {
  showLoading('กำลังจัดเตรียมเอกสารและรูปภาพ...');
  try {
    const data = await callApi('getSubmissionForPrint', { token: authToken, req_id: reqId });
    hideLoading();
    const item = data.item;
    const imgs = data.imagesBase64 || [];
    const imgsHtml = imgs.map((b64, i) => `
      <div style="width: 48%; text-align:center; margin-bottom:10px;">
        <img src="${b64}">
        <div style="font-size:11pt;">ภาพประกอบที่ ${i + 1}</div>
      </div>
    `).join('');

    document.getElementById('printOnlyContainer').innerHTML = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
        <h3 style="margin:0; font-weight:bold;">แบบเสนอขออนุมัติกิจกรรมพัฒนาคุณภาพชีวิต (กพช.)</h3>
        <div style="font-size:12pt;">รหัสอ้างอิงเอกสาร: ${esc(item.req_id)} | วันที่ยื่นคำขอ: ${esc(item.created_at)}</div>
      </div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:15px;" border="1" cellpadding="6">
        <tr>
          <td style="width:50%;"><b>ชื่อ-สกุล นักศึกษา:</b> ${esc(item.student_name)}</td>
          <td style="width:50%;"><b>รหัสนักศึกษา:</b> ${esc(item.student_id)} (${esc(item.level)})</td>
        </tr>
        <tr>
          <td><b>ครูประจำกลุ่ม:</b> ${esc(item.teacher_name)}</td>
          <td><b>จำนวนชั่วโมง กพช. ที่ขอ:</b> ${esc(item.hours)} ชั่วโมง</td>
        </tr>
        <tr>
          <td><b>ระยะเวลาโครงการ:</b> ${esc(item.activity_date || '-')} ถึง ${esc(item.activity_end_date || '-')}</td>
          <td><b>สถานที่:</b> ${esc(item.location || '-')}</td>
        </tr>
      </table>
      <p><b>1. ชื่อกิจกรรม / โครงการ:</b> ${esc(item.activity_name)}</p>
      <p><b>2. รายละเอียดการปฏิบัติกิจกรรมและผลที่ได้รับ:</b></p>
      <div style="border:1px solid #000; padding:10px; min-height:80px; white-space:pre-line; margin-bottom:15px;">${esc(item.activity_detail)}</div>
      <p><b>3. ภาพถ่ายหลักฐานการทำกิจกรรม:</b></p>
      <div class="print-img-box" style="display:flex; flex-wrap:wrap; justify-content:space-around;">${imgsHtml}</div>
      <div class="sig-grid">
        <div class="sig-box">
          ลงชื่อ......................................................<br>
          (${esc(item.teacher_name)})<br>ครูประจำกลุ่ม / ผู้เสนอโครงการ<br>
          <small>อนุมัติระบบ: ${esc(item.teacher_approved_at || 'รอดำเนินการ')}</small>
        </div>
        <div class="sig-box">
          ลงชื่อ......................................................<br>
          (......................................................)<br>คณะกรรมการพิจารณา กพช. ท่านที่ 1<br>
          <small>อนุมัติระบบ: ${esc(item.comm1_approved_at || 'รอดำเนินการ')}</small>
        </div>
        <div class="sig-box">
          ลงชื่อ......................................................<br>
          (......................................................)<br>คณะกรรมการพิจารณา กพช. ท่านที่ 2<br>
          <small>อนุมัติระบบ: ${esc(item.comm2_approved_at || 'รอดำเนินการ')}</small>
        </div>
        <div class="sig-box">
          ลงชื่อ......................................................<br>
          (......................................................)<br>คณะกรรมการพิจารณา กพช. ท่านที่ 3<br>
          <small>อนุมัติระบบ: ${esc(item.comm3_approved_at || 'รอดำเนินการ')}</small>
        </div>
      </div>
      <div style="text-align:center; margin-top:10px; page-break-inside:avoid;">
        <b>ความเห็นผู้อำนวยการสถานศึกษา:</b> [ ] อนุมัติ &nbsp;&nbsp;&nbsp; [ ] ไม่อนุมัติ<br><br>
        ลงชื่อ......................................................<br>(ผู้อำนวยการสถานศึกษา)<br>
        <small>อนุมัติระบบ: ${esc(item.director_approved_at || 'รอดำเนินการ')}</small>
      </div>
    `;
    setTimeout(() => window.print(), 300);
  } catch (err) {
    hideLoading();
    safeAlert('ผิดพลาด', err.message, 'error');
  }
}

// ==================== นายทะเบียน ====================
function toggleAllChecks(master) {
  document.querySelectorAll('.reg-check').forEach(cb => cb.checked = master.checked);
}

function exportRegistrarCSV() {
  const approved = dashItems.filter(x => x.current_step === 'APPROVED_FOR_REGISTRAR');
  if (approved.length === 0) return safeAlert('แจ้งเตือน', 'ไม่มีรายการที่รอลงทะเบียนในขณะนี้', 'info');

  const headers = ['ลำดับ', 'รหัสคำขอ', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'ระดับชั้น', 'ครูประจำกลุ่ม', 'ชื่อกิจกรรม', 'วันที่เริ่มโครงการ', 'วันสิ้นสุดโครงการ', 'สถานที่', 'จำนวนชั่วโมง', 'วันที่ ผอ.อนุมัติ'];
  const csvEscape = v => `"${String(v || '').replace(/"/g, '""')}"`;

  const lines = [headers.map(csvEscape).join(',')];
  approved.forEach((r, idx) => {
    lines.push([
      idx + 1, r.req_id, r.student_id, r.student_name, r.level, r.teacher_name,
      r.activity_name, r.activity_date, r.activity_end_date, r.location, r.hours, r.director_approved_at
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
  const ids = Array.from(new Set(Array.from(document.querySelectorAll('.reg-check:checked')).map(cb => cb.value)));
  if (ids.length === 0) return safeAlert('แจ้งเตือน', 'กรุณาติ๊กเลือกรายการที่กรอกลงทะเบียนเรียบร้อยแล้ว', 'warning');

  Swal.fire({
    title: `ยืนยันปิดงาน ${ids.length} รายการ?`,
    text: 'รายการที่เลือกจะเปลี่ยนสถานะเป็น "บันทึกทะเบียนเรียบร้อย"',
    icon: 'question', showCancelButton: true,
    confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก'
  }).then(async res => {
    if (res.isConfirmed) {
      showLoading('กำลังอัปเดตสถานะ...');
      try {
        const r = await callApi('markRegistrarCompleted', { token: authToken, req_ids: ids });
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
  document.getElementById('adminUsersView').classList.toggle('d-none', tab !== 'users');
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

// ==================== เริ่มทำงาน ====================
function initApp() {
  renderNavbar();
  loadTeachersDropdown();
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