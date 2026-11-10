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
let pendingExam = null;
let currentAppSettings = null; // Menyimpan data app_settings (enter_password, exit_password)

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
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
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

// LOGIN SISWA
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

    // 1. Cek Data Siswa
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

    // 2. Ambil Konfigurasi enter_password dari Tabel app_settings
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

// MEMUAT SOAL DENGAN CARD TEMA SMAN 1 JAKARTA
async function loadAvailableExams(studentClass) {
    const { data: exams, error } = await currentClient
        .from('exams')
        .select('*')
        .eq('is_active', true);

    const { data: history } = await currentClient
        .from('exam_submissions')
        .select('*')
        .eq('nisn', loggedInStudent.nisn);

    const completedSubjectIds = (history || [])
        .filter(h => h.is_completed)
        .map(h => String(h.subject_id));

    const container = document.getElementById('examListContainer');
    if (error || !exams || exams.length === 0) {
        container.innerHTML = `
            <div class="bg-white border border-slate-200 p-6 rounded-2xl text-center shadow-sm">
                <p class="text-slate-500 text-xs font-semibold">Belum ada kelas ujian aktif hari ini.</p>
            </div>`;
        return;
    }

    container.innerHTML = exams.map(exam => {
        const isFinished = completedSubjectIds.includes(String(exam.id));

        return `
        <div class="exam-card flex justify-between items-center ${isFinished ? 'opacity-60' : ''}">
            <div>
                <h3 class="font-bold text-blue-600 text-base leading-snug">${exam.subject_name}</h3>
                <p class="text-xs text-slate-500 mt-0.5">Google Form Evaluasi Pembelajaran</p>
            </div>
            ${isFinished ? `
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    Selesai
                </span>
            ` : `
                <button onclick="promptExamToken('${exam.id}', '${encodeURIComponent(exam.subject_name)}', '${encodeURIComponent(exam.form_url)}')" class="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 active:scale-95 transition">
                    Mulai &rarr;
                </button>
            `}
        </div>`;
    }).join('');
}

// MEMBUKA MODAL AUTHENTIKASI PASSWORD UJIAN
function promptExamToken(id, name, formUrl) {
    playSound('click');
    pendingExam = {
        id: id,
        subjectName: decodeURIComponent(name),
        formUrl: decodeURIComponent(formUrl)
    };

    document.getElementById('inputExamToken').value = '';
    document.getElementById('tokenModal').classList.remove('hidden');
}

function closeTokenModal() {
    playSound('click');
    document.getElementById('tokenModal').classList.add('hidden');
    pendingExam = null;
}

// VERIFIKASI PASSWORD UJIAN TERHADAP TABEL app_settings (enter_password)
document.getElementById('tokenForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('click');
    const inputToken = document.getElementById('inputExamToken').value.trim();

    if (!pendingExam) return;

    // Ambil enter_password dari app_settings
    const requiredPassword = currentAppSettings?.enter_password || 'sman1jkt';

    if (inputToken !== requiredPassword) {
        showModernAlert("Password ujian yang Anda masukkan salah! Mintalah password resmi kepada proktor/pengawas.", "Password Ujian Salah", "error");
        return;
    }

    const examToStart = pendingExam;
    closeTokenModal();

    // Catat awal pengerjaan ke Supabase
    await currentClient.from('exam_submissions').upsert([{
        nisn: loggedInStudent.nisn,
        student_name: loggedInStudent.nama,
        student_class: loggedInStudent.student_class,
        subject_id: examToStart.id,
        is_completed: false
    }], { onConflict: 'nisn,subject_id' });

    // Buka iframe Google Form
    const iframe = document.getElementById('examIframe');
    const frameContainer = document.getElementById('examFrameContainer');
    const activeTitle = document.getElementById('activeExamTitle');

    if (iframe) iframe.src = examToStart.formUrl;
    if (activeTitle) activeTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ujian: ${examToStart.subjectName}`;
    
    frameContainer?.classList.remove('hidden');
    requestFullscreenMode();
});

async function finishExamFrame() {
    playSound('click');
    if (confirm("Apakah Anda yakin telah selesai menjawab di Google Form? Status akan dikunci di database.")) {
        if (pendingExam?.id && currentClient) {
            await currentClient
                .from('exam_submissions')
                .update({ is_completed: true })
                .eq('nisn', loggedInStudent.nisn)
                .eq('subject_id', pendingExam.id);
        }

        playSound('success');
        const iframe = document.getElementById('examIframe');
        if (iframe) iframe.src = "";
        document.getElementById('examFrameContainer')?.classList.add('hidden');
        
        loadAvailableExams(loggedInStudent.student_class);
        requestFullscreenMode();

        showModernAlert("Ujian telah selesai dikerjakan dan status terkunci di database.", "Ujian Selesai", "success");
    }
}

function logoutExam() {
    playSound('click');
    isExamActive = false;
    location.reload();
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

function requestFullscreenMode() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        triggerViolationNotice('Dilarang berpindah tab atau meminimalkan browser!');
    }
});

window.addEventListener('blur', () => {
    triggerViolationNotice('Dilarang membuka/mengaktifkan aplikasi lain saat ujian!');
});

const handleFullscreenChange = () => {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen && isExamActive) {
        triggerViolationNotice('Layar ujian wajib dalam mode layar penuh (Fullscreen)!');
    }
};

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
