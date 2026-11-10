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
let currentAppSettings = null;
let iframeLoadCount = 0; // Penanda untuk mendeteksi submit form

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
        // Nada Efek Berhasil Submit GForm (Melodi Sukses)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
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

    // Ambil setting enter_password
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

// LOAD DAFTAR SOAL & CEK STATUS TERKUNCI
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
                    🔒 Selesai
                </span>
            ` : `
                <button onclick="promptExamToken('${exam.id}', '${encodeURIComponent(exam.subject_name)}', '${encodeURIComponent(exam.form_url)}')" class="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 active:scale-95 transition">
                    Mulai &rarr;
                </button>
            `}
        </div>`;
    }).join('');
}

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

    const requiredPassword = currentAppSettings?.enter_password || 'sman1jkt';

    if (inputToken !== requiredPassword) {
        showModernAlert("Password ujian yang Anda masukkan salah! Mintalah password resmi kepada proktor/pengawas.", "Password Ujian Salah", "error");
        return;
    }

    const examToStart = pendingExam;
    closeTokenModal();

    // Reset hitungan reload iframe
    iframeLoadCount = 0;

    // Record pengerjaan awal di Supabase
    await currentClient.from('exam_submissions').upsert([{
        nisn: loggedInStudent.nisn,
        student_name: loggedInStudent.nama,
        student_class: loggedInStudent.student_class,
        subject_id: examToStart.id,
        is_completed: false
    }], { onConflict: 'nisn,subject_id' });

    const iframe = document.getElementById('examIframe');
    const frameContainer = document.getElementById('examFrameContainer');
    const activeTitle = document.getElementById('activeExamTitle');

    if (iframe) {
        iframe.src = examToStart.formUrl;
        
        // PASANG EVENT LISTENER ONLOAD UNTUK DETEKSI OTOMATIS SUBMIT GFORM
        iframe.onload = handleIframeLoad;
    }

    if (activeTitle) activeTitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ujian: ${examToStart.subjectName}`;
    
    frameContainer?.classList.remove('hidden');
    requestFullscreenMode();
});

// LOGIKA OTOMATIS SAAT GOOGLE FORM TERKIRIM
async function handleIframeLoad() {
    iframeLoadCount++;

    // Load pertama = memuat soal Google Form
    // Load kedua = Google Form telah disubmit / dikirim siswa!
    if (iframeLoadCount >= 2 && pendingExam) {
        // 1. Bunyikan efek suara sukses!
        playSound('success');

        // 2. Simpan status is_completed = true ke Supabase
        await currentClient
            .from('exam_submissions')
            .update({ 
                is_completed: true,
                violation_count: violations 
            })
            .eq('nisn', loggedInStudent.nisn)
            .eq('subject_id', pendingExam.id);

        // 3. Tutup iframe & bersihkan state
        const iframe = document.getElementById('examIframe');
        if (iframe) {
            iframe.onload = null;
            iframe.src = "";
        }
        document.getElementById('examFrameContainer')?.classList.add('hidden');

        // 4. Perbarui UI dashboard agar soal langsung TERKUNCI
        loadAvailableExams(loggedInStudent.student_class);
        requestFullscreenMode();

        // 5. Tampilkan notifikasi sukses
        showModernAlert("Jawaban Google Form berhasil terkirim! Status ujian Anda telah otomatis terkunci di database.", "Ujian Berhasil Dikirim", "success");
        pendingExam = null;
    }
}

// Tombol Batal Keluar Darurat (Jika siswa membatalkan sebelum submit)
function cancelExamFrame() {
    playSound('click');
    if (confirm("Apakah Anda yakin ingin keluar dari ujian ini? Jawaban yang belum dikirim ke Google Form mungkin tidak tersimpan.")) {
        const iframe = document.getElementById('examIframe');
        if (iframe) {
            iframe.onload = null;
            iframe.src = "";
        }
        document.getElementById('examFrameContainer')?.classList.add('hidden');
        requestFullscreenMode();
        pendingExam = null;
    }
}

function logoutExam() {
    playSound('click');
    isExamActive = false;
    location.reload();
}

// LOGIKA KEAMANAN DISTRAKSI (ANTI FALSE POSITIVE)
let isInteractingWithForm = false;

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
