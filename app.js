// Konfigurasi 3 Server Supabase SMAN 1 Jakarta
const SUPABASE_SERVERS = {
    "X": {
        name: "Kelas X",
        url: "https://ulroqkrnwzzrgkasrqit.supabase.co",
        anonKey: "sb_publishable_DJm-HRJpia9X3CzOlBq61Q_Dqct-DPi"
    },
    "XI": {
        name: "Kelas XI",
        url: "https://oypvpmhvkqhuhamjpjnu.supabase.co",
        anonKey: "sb_publishable_H1n_goBAP5xaUrso_sAoWA_F491hDVE"
    },
    "XII": {
        name: "Kelas XII",
        url: "https://uqxzhrdmpplnlfwvlkag.supabase.co",
        anonKey: "sb_publishable_pXrBRuXMyM65VUv_jIC7HQ_hza_4hTJ"
    }
};

let currentClient = null;
let loggedInStudent = null;
let violations = 0;
let isExamActive = false;
let activeExam = null;
let currentAppSettings = null;
let iframeLoadCount = 0;
let isInteractingWithForm = false;

// Web Audio Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'alarm') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }
}

function requestFullscreenMode() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

function triggerViolationNotice(reason) {
    if (!isExamActive) return;

    playSound('alarm');
    violations++;
    const vReason = document.getElementById('violationReason');
    const vCount = document.getElementById('violationCount');
    if (vReason) vReason.innerText = reason;
    if (vCount) vCount.innerText = violations;
    document.getElementById('violationModal')?.classList.remove('hidden');
}

function resumeExam() {
    playSound('click');
    document.getElementById('violationModal')?.classList.add('hidden');
    requestFullscreenMode();
}

function showModernAlert(message, title = 'Akses Ditolak', type = 'error') {
    playSound(type === 'success' ? 'success' : 'alarm');
    const modal = document.getElementById('modernAlertModal');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');

    if (alertTitle) alertTitle.innerText = title;
    if (alertMessage) alertMessage.innerText = message;
    modal?.classList.remove('hidden');
}

function closeModernAlert() {
    playSound('click');
    document.getElementById('modernAlertModal')?.classList.add('hidden');
}

// 1. LOGIN SISWA
// NAVIGATION MULTI-STEP LOGIN
function goToStep2(angkatan) {
    playSound('click');
    const label = SUPABASE_SERVERS[angkatan]?.name || `Kelas ${angkatan}`;
    
    document.getElementById('selectedServerLabel').innerText = label;
    document.getElementById('loginStepSubtitle').innerText = `Langkah 2 dari 2: Autentikasi Siswa (${label})`;
    
    document.getElementById('stepSelectAngkatan')?.classList.add('hidden');
    document.getElementById('stepCredentials')?.classList.remove('hidden');
}

function goToStep1() {
    playSound('click');
    document.getElementById('loginStepSubtitle').innerText = 'Langkah 1 dari 2: Pilih Angkatan Server Ujian';
    
    document.getElementById('stepCredentials')?.classList.add('hidden');
    document.getElementById('stepSelectAngkatan')?.classList.remove('hidden');
}

// EVENT LISTENER TAHAP 1: PILIH KELAS
document.getElementById('step1Form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const angkatan = document.getElementById('serverAngkatan').value;
    goToStep2(angkatan);
});

// EVENT LISTENER TAHAP 2: AUTENTIKASI SISWA & LOGIN SUPABASE
document.getElementById('studentLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('click');
    
    const angkatan = document.getElementById('serverAngkatan').value;
    const nisn = document.getElementById('studentNisn').value.trim();
    const pass = document.getElementById('studentPass').value.trim();

    const config = SUPABASE_SERVERS[angkatan];
    
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        currentClient = supabase.createClient(config.url, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    } else {
        showModernAlert('Library Supabase gagal dimuat.', 'Gagal Koneksi', 'error');
        return;
    }

    const { data, error } = await currentClient
        .from('students')
        .select('*')
        .eq('nisn', nisn)
        .maybeSingle();

    if (error || !data) {
        showModernAlert(`NISN (${nisn}) tidak ditemukan pada ${config.name}.`, 'NISN Tidak Ditemukan', 'error');
        return;
    }

    const validPassword = data.password ? data.password : data.nisn;
    if (pass !== validPassword) {
        showModernAlert('Password yang Anda masukkan salah!', 'Password Salah', 'error');
        return;
    }

    // Fetch app_settings untuk enter_password
    const { data: settingsData } = await currentClient
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    currentAppSettings = settingsData;
    loggedInStudent = data;
    isExamActive = true;
    
    document.getElementById('studentLoginModal')?.classList.add('hidden');
    document.getElementById('examApp')?.classList.remove('hidden');
    document.getElementById('lblStudentName').innerText = data.nama;
    document.getElementById('lblStudentClass').innerText = `Kelas: ${data.student_class} | NISN: ${data.nisn}`;

    requestFullscreenMode();
    loadAvailableExams(data.student_class);
});

// 2. DASHBOARD SOAL UJIAN
async function loadAvailableExams(studentClass) {
    const container = document.getElementById('examListContainer');
    if (!container) return;

    const { data: exams, error } = await currentClient
        .from('exams')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error("Error fetching exams:", error);
        container.innerHTML = `
            <div class="bg-white border border-slate-200 p-6 rounded-2xl text-center shadow-sm">
                <p class="text-rose-500 text-xs font-semibold">Gagal mengambil data ujian dari database server.</p>
            </div>`;
        return;
    }

    const { data: history } = await currentClient
        .from('exam_submissions')
        .select('*')
        .eq('nisn', String(loggedInStudent.nisn).trim());

    const completedSubjectIds = new Set(
        (history || [])
            .filter(h => h.is_completed === true || String(h.is_completed) === 'true')
            .map(h => String(h.subject_id).trim())
    );

    const userClass = String(studentClass).trim().toLowerCase();
    
    const availableExams = (exams || []).filter(exam => {
        const examClass = String(exam.student_class || exam.target_rombel || '').trim().toLowerCase();
        return examClass === userClass || 
               examClass === 'semua' || 
               userClass.startsWith(examClass) || 
               examClass.startsWith(userClass);
    });

    if (availableExams.length === 0) {
        container.innerHTML = `
            <div class="bg-white border border-slate-200 p-6 rounded-2xl text-center shadow-sm">
                <p class="text-slate-500 text-xs font-semibold">Belum ada kelas ujian aktif yang ditargetkan untuk kelas ${studentClass}.</p>
            </div>`;
        return;
    }

    container.innerHTML = availableExams.map(exam => {
        const examIdStr = String(exam.id).trim();
        const isFinished = completedSubjectIds.has(examIdStr);
        const subjectName = exam.subject_name || exam.mata_pelajaran || 'Uji Coba Ujian';
        const formUrl = exam.form_url || exam.link_form || '';

        return `
        <div class="exam-card flex justify-between items-center ${isFinished ? 'opacity-60 bg-slate-50' : ''}">
            <div>
                <h3 class="font-bold text-blue-600 text-base leading-snug">${subjectName}</h3>
                <p class="text-xs text-slate-500 mt-0.5">Google Form Evaluasi Pembelajaran</p>
            </div>
            ${isFinished ? `
                <span class="text-xs font-bold text-slate-400 bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1">
                    🔒 Selesai
                </span>
            ` : `
                <button onclick="promptExamToken('${exam.id}', '${encodeURIComponent(subjectName)}', '${encodeURIComponent(formUrl)}')" class="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 active:scale-95 transition">
                    Mulai &rarr;
                </button>
            `}
        </div>`;
    }).join('');
}

// 2.1 POPUP INPUT ENTER PASSWORD
function promptExamToken(id, name, formUrl) {
    playSound('click');
    activeExam = {
        id: String(id).trim(),
        subjectName: decodeURIComponent(name),
        formUrl: decodeURIComponent(formUrl)
    };

    document.getElementById('inputExamToken').value = '';
    document.getElementById('tokenModal')?.classList.remove('hidden');
}

// PERBAIKAN: JANGAN MENGHAPUS activeExam SAAT MENUTUP MODAL DARI TOMBOL BATAL/SELESAI
function closeTokenModal() {
    playSound('click');
    document.getElementById('tokenModal')?.classList.add('hidden');
}

// 2.2 VERIFIKASI ENTER PASSWORD (AMBIL LANGSUNG DARI DB / APP_SETTINGS)
document.getElementById('tokenForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('click');
    const inputToken = document.getElementById('inputExamToken').value.trim();

    if (!activeExam) {
        showModernAlert("Data ujian tidak ditemukan. Silakan pilih kembali ujian.", "Gagal Memuat", "error");
        return;
    }

    // Ambil ulang settings jika null
    if (!currentAppSettings && currentClient) {
        const { data: fetchSettings } = await currentClient
            .from('app_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
        if (fetchSettings) currentAppSettings = fetchSettings;
    }

    const requiredEnterPassword = currentAppSettings?.enter_password || '12345';

    if (String(inputToken) !== String(requiredEnterPassword)) {
        showModernAlert("Password Ujian yang Anda masukkan salah! Mintalah password resmi kepada pengawas kelas.", "Password Ujian Salah", "error");
        return;
    }

    // Sembunyikan modal token TANPA menghapus data activeExam
    document.getElementById('tokenModal')?.classList.add('hidden');
    
    // Jalankan pemuatan frame ujian
    startExamDirectly();
});

// 3. PENYEDIAAN FRAME EMBEDDED GOOGLE FORM
function startExamDirectly() {
    if (!activeExam) {
        console.error("startExamDirectly gagal: activeExam bernilai null");
        return;
    }

    iframeLoadCount = 0;

    const studentNisn = String(loggedInStudent.nisn).trim();
    const subjectIdStr = String(activeExam.id).trim();

    // Catat data awal pengerjaan (is_completed: false) ke Supabase secara background
    currentClient.from('exam_submissions').upsert([{
        nisn: studentNisn,
        student_name: loggedInStudent.nama,
        student_class: loggedInStudent.student_class,
        subject_id: subjectIdStr,
        is_completed: false
    }], { onConflict: 'nisn,subject_id' }).then(({ error }) => {
        if (error) console.warn("Peringatan Supabase di startExamDirectly:", error.message);
    });

    const iframe = document.getElementById('examIframe');
    const frameContainer = document.getElementById('examFrameContainer');
    const activeTitle = document.getElementById('activeExamTitle');

    if (iframe) {
        iframe.src = activeExam.formUrl;
        iframe.onload = handleIframeSubmit;
    }

    if (activeTitle) {
        activeTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ujian: ${activeExam.subjectName}`;
    }
    
    // Tampilkan frame ujian & masuk mode layar penuh
    frameContainer?.classList.remove('hidden');
    requestFullscreenMode();
}

// FUNGSI PENYIMPANAN SUPABASE DENGAN CATCH ERROR
async function markExamCompleted() {
    if (!activeExam || !loggedInStudent || !currentClient) return false;

    const nisn = String(loggedInStudent.nisn).trim();
    const subjectId = String(activeExam.id).trim();

    const { error } = await currentClient
        .from('exam_submissions')
        .upsert([{
            nisn: nisn,
            student_name: loggedInStudent.nama,
            student_class: loggedInStudent.student_class,
            subject_id: subjectId,
            is_completed: true,
            violation_count: violations
        }], { onConflict: 'nisn,subject_id' });

    if (error) {
        showModernAlert('Gagal menyimpan status ke Supabase: ' + error.message, 'Database Error', 'error');
        return false;
    }
    return true;
}

// BUKA TAMPILAN STANDBY MINI GAME FULLSCREEN
function finishExamUI() {
    playSound('success');

    const iframe = document.getElementById('examIframe');
    if (iframe) {
        iframe.onload = null;
        iframe.src = "";
    }
    document.getElementById('examFrameContainer')?.classList.add('hidden');

    if (typeof resetGame === 'function') resetGame();
    document.getElementById('exitGameModal')?.classList.remove('hidden');

    if (loggedInStudent) {
        loadAvailableExams(loggedInStudent.student_class);
    }
}

// 4. DETEKSI IFRAME SUBMIT GOOGLE FORM
async function handleIframeSubmit() {
    iframeLoadCount++;

    if (iframeLoadCount >= 2 && activeExam) {
        const success = await markExamCompleted();
        if (success) {
            finishExamUI();
        }
    }
}

// BACKUP MANUAL TOMBOL "SAYA SUDAH KIRIM"
async function confirmFinished() {
    if (!activeExam) return;
    if (!confirm('Pastikan Google Form sudah benar-benar terkirim. Lanjutkan keluar?')) return;
    
    const success = await markExamCompleted();
    if (success) {
        finishExamUI();
    }
}

function logoutExam() {
    playSound('click');
    isExamActive = false;
    location.reload();
}

// LOGIKA KEAMANAN DISTRAKSI
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isExamActive) {
        triggerViolationNotice('Dilarang berpindah tab atau meminimalkan browser!');
    }
});

window.addEventListener('blur', () => {
    if (!isExamActive) return;

    setTimeout(() => {
        const activeElem = document.activeElement;
        const isIframeActive = activeElem && activeElem.tagName === 'IFRAME';
        
        if (isIframeActive || isInteractingWithForm) {
            return;
        }

        if (!document.hasFocus()) {
            triggerViolationNotice('Dilarang membuka/mengaktifkan aplikasi lain saat ujian!');
        }
    }, 200);
});

const handleFullscreenChange = () => {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen && isExamActive) {
        setTimeout(() => {
            const currentFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            if (!currentFullscreen && isExamActive) {
                triggerViolationNotice('Layar ujian wajib dalam mode layar penuh (Fullscreen)!');
            }
        }, 300);
    }
};

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
