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

// FUNGSI UTILITY DILETAKKAN DI ATAS AGAR TIDAK CAUSE REFERENCE ERROR
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

    // Ambil settings app_settings untuk exit_password
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

    // Ambil semua soal aktif
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

    // Ambil riwayat pengerjaan yang SUDAH SELESAI
    const { data: history } = await currentClient
        .from('exam_submissions')
        .select('subject_id')
        .eq('nisn', loggedInStudent.nisn)
        .eq('is_completed', true);

    const completedSubjectIds = (history || []).map(h => String(h.subject_id));
    const userClass = String(studentClass).trim().toLowerCase();
    
    const availableExams = (exams || []).filter(exam => {
        const examClass = String(exam.student_class || '').trim().toLowerCase();
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
        const isFinished = completedSubjectIds.includes(String(exam.id));
        const subjectName = exam.subject_name || 'Uji Coba Ujian';
        const formUrl = exam.form_url || '';

        return `
        <div class="exam-card flex justify-between items-center ${isFinished ? 'opacity-60' : ''}">
            <div>
                <h3 class="font-bold text-blue-600 text-base leading-snug">${subjectName}</h3>
                <p class="text-xs text-slate-500 mt-0.5">Google Form Evaluasi Pembelajaran</p>
            </div>
            ${isFinished ? `
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    🔒 Selesai
                </span>
            ` : `
                <button onclick="startExamDirectly('${exam.id}', '${encodeURIComponent(subjectName)}', '${encodeURIComponent(formUrl)}')" class="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 active:scale-95 transition">
                    Mulai &rarr;
                </button>
            `}
        </div>`;
    }).join('');
}

// 3. MULAI UJIAN
async function startExamDirectly(id, name, formUrl) {
    playSound('click');
    activeExam = {
        id: id,
        subjectName: decodeURIComponent(name),
        formUrl: decodeURIComponent(formUrl)
    };

    iframeLoadCount = 0;

    await currentClient.from('exam_submissions').upsert([{
        nisn: loggedInStudent.nisn,
        student_name: loggedInStudent.nama,
        student_class: loggedInStudent.student_class,
        subject_id: activeExam.id,
        is_completed: false
    }], { onConflict: 'nisn,subject_id' });

    const iframe = document.getElementById('examIframe');
    const frameContainer = document.getElementById('examFrameContainer');
    const activeTitle = document.getElementById('activeExamTitle');

    if (iframe) {
        iframe.src = activeExam.formUrl;
        iframe.onload = handleIframeSubmit;
    }

    if (activeTitle) activeTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ujian: ${activeExam.subjectName}`;
    
    frameContainer?.classList.remove('hidden');
    requestFullscreenMode();
}

// 4. OTOMATISASI SUBMIT FORM
function handleIframeSubmit() {
    iframeLoadCount++;

    if (iframeLoadCount >= 2 && activeExam) {
        playSound('success');

        const iframe = document.getElementById('examIframe');
        if (iframe) {
            iframe.onload = null;
            iframe.src = "";
        }
        document.getElementById('examFrameContainer')?.classList.add('hidden');

        if (typeof resetGame === 'function') resetGame();
        document.getElementById('inputExitPassword').value = '';
        document.getElementById('exitGameModal')?.classList.remove('hidden');
    }
}

// 5. VERIFIKASI EXIT PASSWORD
document.getElementById('exitPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    playSound('click');
    const exitPassInput = document.getElementById('inputExitPassword').value.trim();
    const requiredExitPassword = currentAppSettings?.exit_password || 'sman1jkt2';

    if (exitPassInput !== requiredExitPassword) {
        showModernAlert("Password Keluar Ujian yang Anda masukkan salah! Mintalah password exit resmi kepada pengawas kelas.", "Password Exit Salah", "error");
        return;
    }

    if (activeExam?.id && currentClient) {
        await currentClient
            .from('exam_submissions')
            .update({ 
                is_completed: true,
                violation_count: violations 
            })
            .eq('nisn', loggedInStudent.nisn)
            .eq('subject_id', activeExam.id);
    }

    playSound('success');
    document.getElementById('exitGameModal')?.classList.add('hidden');
    
    loadAvailableExams(loggedInStudent.student_class);
    requestFullscreenMode();

    showModernAlert("Ujian telah sukses diverifikasi pengawas dan status otomatis terkunci di database.", "Ujian Selesai", "success");
    activeExam = null;
});

function logoutExam() {
    playSound('click');
    isExamActive = false;
    location.reload();
}

// EVENT LISTENERS DETEKSI DISTRAKSI
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
