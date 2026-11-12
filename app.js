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

// ==========================================
// 0. SISTEM AUDIO MP3, PENGUAT 3X & SYNTHESIZER
// ==========================================
const CBT_AUDIO = {
    alarm: new Audio('./alarm.mp3'),
    masuk: new Audio('./masuk_ujian_cbt.mp3'),
    berhasil: new Audio('./berhasil_kirim_gf.mp3'),
    isUnlocked: false
};

CBT_AUDIO.alarm.loop = true;
CBT_AUDIO.alarm.preload = 'auto';
CBT_AUDIO.masuk.preload = 'auto';
CBT_AUDIO.berhasil.preload = 'auto';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isBoosterConnected = false;

// Penguat sinyal audio digital 300% untuk alarm pelanggaran
function initAudioBooster() {
    if (isBoosterConnected) return;
    try {
        const source = audioCtx.createMediaElementSource(CBT_AUDIO.alarm);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 3.0;
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        isBoosterConnected = true;
    } catch (e) {
        // Abaikan jika WebKit membatasi MediaElementSource
    }
}

// Buka kunci pembatasan autoplay audio iOS SEB pada interaksi pertama
function unlockAllAudio() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    initAudioBooster();

    if (CBT_AUDIO.isUnlocked) return;
    [CBT_AUDIO.alarm, CBT_AUDIO.masuk, CBT_AUDIO.berhasil].forEach(audio => {
        audio.muted = true;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
        }).catch(() => {});
    });
    CBT_AUDIO.isUnlocked = true;
}
document.addEventListener('touchstart', unlockAllAudio, { once: true });
document.addEventListener('click', unlockAllAudio, { once: true });

// Synthesizer diperkeras & diperpanjang untuk efek UI dan fallback jika MP3 gagal dimuat
function playSynthFallback(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    if (type === 'alarm' || type === 'alert_error') {
        const duration = type === 'alarm' ? 2.5 : 1.4;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        gain.gain.setValueAtTime(0.85, now);
        for (let t = 0; t < duration; t += 0.4) {
            osc.frequency.setValueAtTime(960, now + t);
            osc.frequency.setValueAtTime(640, now + t + 0.2);
        }
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    } else if (type === 'click') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    } else if (type === 'success') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        osc.frequency.setValueAtTime(783.99, now + 0.4);
        osc.frequency.setValueAtTime(1046.50, now + 0.6);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
    }
}

function playSound(type) {
    if (type === 'alarm') {
        CBT_AUDIO.alarm.volume = 1.0;
        if (CBT_AUDIO.alarm.paused) {
            CBT_AUDIO.alarm.currentTime = 0;
            CBT_AUDIO.alarm.play().catch(() => playSynthFallback('alarm'));
        }
    } else if (type === 'masuk') {
        CBT_AUDIO.masuk.volume = 1.0;
        CBT_AUDIO.masuk.currentTime = 0;
        CBT_AUDIO.masuk.play().catch(() => playSynthFallback('success'));
    } else if (type === 'success') {
        stopViolationAlarm();
        CBT_AUDIO.berhasil.volume = 1.0;
        CBT_AUDIO.berhasil.currentTime = 0;
        CBT_AUDIO.berhasil.play().catch(() => playSynthFallback('success'));
    } else if (type === 'alert_error') {
        playSynthFallback('alert_error');
    } else {
        playSynthFallback('click');
    }
}

function stopViolationAlarm() {
    if (CBT_AUDIO.alarm && !CBT_AUDIO.alarm.paused) {
        CBT_AUDIO.alarm.pause();
        CBT_AUDIO.alarm.currentTime = 0;
    }
}

// ==========================================
// GERBANG VERIFIKASI SUARA (AUDIO GATEKEEPER)
// ==========================================
let expectedAudioCode = "";

function playAudioGateCode() {
    unlockAllAudio();

    expectedAudioCode = String(Math.floor(100 + Math.random() * 900));
    const angkaTeks = {
        '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
        '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
    };
    const ejaanSuara = expectedAudioCode.split('').map(d => angkaTeks[d]).join(' ... ');

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Kode suara Anda adalah ... ${ejaanSuara}`);
        utterance.lang = 'id-ID';
        utterance.rate = 0.85;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
    } else {
        playSound('masuk');
    }
}

function verifyAudioGate() {
    const inputEl = document.getElementById('inputAudioGateCode');
    const userCode = inputEl ? inputEl.value.trim() : '';

    if (!expectedAudioCode) {
        showModernAlert('Silakan tekan tombol "Putar Kode Suara" terlebih dahulu!', 'Belum Memutar Suara', 'error');
        return;
    }

    if (userCode === expectedAudioCode) {
        playSound('click');
        document.getElementById('audioGateModal')?.classList.add('hidden');
        document.getElementById('studentLoginModal')?.classList.remove('hidden');
    } else {
        if (inputEl) inputEl.value = '';
        showModernAlert(
            'Kode suara tidak cocok atau volume perangkat Anda masih mati. Naikkan volume iPhone/iPad lalu putar ulang kode suara!',
            'Verifikasi Suara Gagal',
            'error'
        );
    }
}

// ==========================================
// PELANGGARAN LOKAL (TANPA KIRIM KE SUPABASE)
// ==========================================
function getLocalViolationKey() {
    const nisn = loggedInStudent ? String(loggedInStudent.nisn).trim() : 'guest';
    const examId = activeExam ? String(activeExam.id).trim() : 'general';
    return `CBT_LOCAL_VIOLATIONS_${nisn}_${examId}`;
}

function loadLocalViolations() {
    const saved = localStorage.getItem(getLocalViolationKey());
    violations = saved ? parseInt(saved, 10) : 0;
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
    localStorage.setItem(getLocalViolationKey(), String(violations));

    const vReason = document.getElementById('violationReason');
    const vCount = document.getElementById('violationCount');
    if (vReason) vReason.innerText = reason;
    if (vCount) vCount.innerText = violations;
    document.getElementById('violationModal')?.classList.remove('hidden');
}

function resumeExam() {
    stopViolationAlarm();
    playSound('click');
    document.getElementById('violationModal')?.classList.add('hidden');
    requestFullscreenMode();
}

function showModernAlert(message, title = 'Akses Ditolak', type = 'error') {
    playSound(type === 'success' ? 'success' : 'alert_error');
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

// ==========================================
// 1. LOGIN SISWA (MULTI-STEP)
// ==========================================
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

document.getElementById('step1Form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const angkatan = document.getElementById('serverAngkatan').value;
    goToStep2(angkatan);
});

document.getElementById('studentLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    unlockAllAudio();
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

// ==========================================
// 2. DASHBOARD SOAL UJIAN
// ==========================================
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

function closeTokenModal() {
    playSound('click');
    document.getElementById('tokenModal')?.classList.add('hidden');
}

document.getElementById('tokenForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    unlockAllAudio();
    const inputToken = document.getElementById('inputExamToken').value.trim();

    if (!activeExam) {
        showModernAlert("Data ujian tidak ditemukan. Silakan pilih kembali ujian.", "Gagal Memuat", "error");
        return;
    }

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

    document.getElementById('tokenModal')?.classList.add('hidden');
    startExamDirectly();
});

// ==========================================
// 3. PENYEDIAAN FRAME EMBEDDED GOOGLE FORM
// ==========================================
function startExamDirectly() {
    if (!activeExam) {
        console.error("startExamDirectly gagal: activeExam bernilai null");
        return;
    }

    loadLocalViolations();
    playSound('masuk');

    iframeLoadCount = 0;

    const studentNisn = String(loggedInStudent.nisn).trim();
    const subjectIdStr = String(activeExam.id).trim();

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
    
    frameContainer?.classList.remove('hidden');
    requestFullscreenMode();
}

// Simpan status selesai tanpa mengirim data pelanggaran ke server Supabase
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
            is_completed: true
        }], { onConflict: 'nisn,subject_id' });

    if (error) {
        showModernAlert('Gagal menyimpan status ke Supabase: ' + error.message, 'Database Error', 'error');
        return false;
    }

    localStorage.removeItem(getLocalViolationKey());
    return true;
}

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

async function handleIframeSubmit() {
    iframeLoadCount++;

    if (iframeLoadCount >= 2 && activeExam) {
        const success = await markExamCompleted();
        if (success) {
            finishExamUI();
        }
    }
}

async function confirmFinished() {
    if (!activeExam) return;
    if (!confirm('Pastikan Google Form sudah benar-benar terkirim. Lanjutkan keluar?')) return;
    
    const success = await markExamCompleted();
    if (success) {
        finishExamUI();
    }
}

function logoutExam() {
    stopViolationAlarm();
    playSound('click');
    isExamActive = false;
    location.reload();
}

// ==========================================
// 4. LOGIKA KEAMANAN DISTRAKSI
// ==========================================
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
