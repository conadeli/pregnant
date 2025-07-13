// 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - 앱 초기화 시작');
    initializeApp();
});

// 추가 안전장치 - window.onload에서도 초기화
window.addEventListener('load', function() {
    console.log('Window Load - 추가 초기화');
    // DOM이 준비되지 않았다면 다시 초기화
    if (!document.getElementById('currentDate').textContent) {
        initializeApp();
    }
});

// Service Worker 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
                // Push 알림 설정
                setupPushNotifications(registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// 전역 변수
let deferredPrompt;
let currentSelectedDate = new Date();
let movementChart = null;

// 앱 초기화 함수
function initializeApp() {
    console.log('앱 초기화 함수 실행');
    
    // 필수 요소들이 존재하는지 확인
    const requiredElements = [
        'currentDate', 'pregnancyWeek', 'selectedDate', 
        'recordMovement', 'saveDiary', 'addFood'
    ];
    
    for (let elementId of requiredElements) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`필수 요소 ${elementId}를 찾을 수 없습니다.`);
            // 0.5초 후 다시 시도
            setTimeout(() => {
                console.log('0.5초 후 재시도');
                initializeApp();
            }, 500);
            return;
        }
    }
    
    checkPregnancyStartDate();
    updateDateAndWeek();
    setupDateSelector();
    loadSelectedDateData();
    setupEventListeners();
    checkWelcomePopup();
    checkReminderPopup();
    setupPWAInstall();
    requestNotificationPermission();
    setupChartControls();
    setupDiary();
    console.log('앱 초기화 완료');
}

// 임신 시작일 확인
function checkPregnancyStartDate() {
    const pregnancyStartDate = localStorage.getItem('pregnancyStartDate');
    if (!pregnancyStartDate) {
        showPregnancyDatePopup();
    }
}

// 임신 시작일 설정 팝업 표시
function showPregnancyDatePopup() {
    const popup = document.getElementById('pregnancyDatePopup');
    const dateInput = document.getElementById('pregnancyStartDate');
    
    // 기본값을 3개월 전으로 설정
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() - 3);
    dateInput.value = defaultDate.toISOString().split('T')[0];
    
    popup.classList.add('show');
}

// 날짜 및 임신 주차 업데이트
function updateDateAndWeek() {
    console.log('날짜 및 임신 주차 업데이트 시작');
    const today = new Date();
    const currentDateElement = document.getElementById('currentDate');
    const pregnancyWeekElement = document.getElementById('pregnancyWeek');
    
    if (!currentDateElement || !pregnancyWeekElement) {
        console.error('날짜 표시 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 현재 날짜 표시
    const dateOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    currentDateElement.textContent = today.toLocaleDateString('ko-KR', dateOptions);
    console.log('현재 날짜 설정:', currentDateElement.textContent);
    
    // 임신 주차 계산
    const pregnancyStartDate = localStorage.getItem('pregnancyStartDate');
    if (pregnancyStartDate) {
        const startDate = new Date(pregnancyStartDate);
        const diffTime = Math.abs(today - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(diffDays / 7);
        const days = diffDays % 7;
        
        pregnancyWeekElement.textContent = `임신 ${weeks}주 ${days}일`;
        console.log('임신 주차 설정:', pregnancyWeekElement.textContent);
    } else {
        pregnancyWeekElement.textContent = '임신 주차를 설정해주세요';
        console.log('임신 주차 미설정');
    }
}

// 날짜 선택기 설정
function setupDateSelector() {
    const selectedDateInput = document.getElementById('selectedDate');
    const todayBtn = document.getElementById('todayBtn');
    
    // 오늘 날짜로 초기화
    selectedDateInput.value = getTodayKey();
    
    // 날짜 변경 이벤트
    selectedDateInput.addEventListener('change', function() {
        currentSelectedDate = new Date(this.value);
        loadSelectedDateData();
    });
    
    // 오늘 버튼
    todayBtn.addEventListener('click', function() {
        const today = new Date();
        currentSelectedDate = today;
        selectedDateInput.value = getTodayKey();
        loadSelectedDateData();
    });
}

// 선택된 날짜 데이터 로드
function loadSelectedDateData() {
    const dateKey = getDateKey(currentSelectedDate);
    const isToday = dateKey === getTodayKey();
    
    // 태동 카운트 로드
    const movementCount = localStorage.getItem(`movement_${dateKey}`) || 0;
    document.getElementById('movementCount').textContent = movementCount;
    
    // 건강 메모 로드
    // 일기는 별도 함수에서 처리
    
    // 음식 기록 로드
    loadFoodList(dateKey);
    
    // 오늘이 아닌 날짜는 편집 제한
    const recordBtn = document.getElementById('recordMovement');
    const foodInput = document.getElementById('foodInput');
    const addFoodBtn = document.getElementById('addFood');
    
    if (!isToday) {
        recordBtn.disabled = true;
        recordBtn.textContent = '과거 기록 (편집 불가)';
        foodInput.disabled = true;
        addFoodBtn.disabled = true;
    } else {
        recordBtn.disabled = false;
        recordBtn.textContent = '태동 기록하기';
        foodInput.disabled = false;
        addFoodBtn.disabled = false;
    }
    
    // 카운트 라벨 업데이트
    const countLabel = document.querySelector('.count-label');
    countLabel.textContent = isToday ? '오늘 기록' : '선택한 날짜 기록';
}

// 이벤트 리스너 설정
function setupEventListeners() {
    console.log('이벤트 리스너 설정 시작');
    
    // 태동 기록 버튼
    const recordBtn = document.getElementById('recordMovement');
    if (recordBtn) {
        console.log('태동 기록 버튼 이벤트 등록');
        recordBtn.addEventListener('click', recordMovement);
        recordBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            console.log('태동 기록 터치 이벤트');
            recordMovement();
        });
    } else {
        console.error('태동 기록 버튼을 찾을 수 없습니다.');
    }
    
    // 일기 저장
    const saveDiaryBtn = document.getElementById('saveDiary');
    if (saveDiaryBtn) {
        console.log('일기 저장 버튼 이벤트 등록');
        saveDiaryBtn.addEventListener('click', saveDiary);
        saveDiaryBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            console.log('일기 저장 터치 이벤트');
            saveDiary();
        });
    } else {
        console.error('일기 저장 버튼을 찾을 수 없습니다.');
    }
    
    // 일기 날짜 선택
    const diaryDateInput = document.getElementById('diaryDate');
    if (diaryDateInput) {
        diaryDateInput.addEventListener('change', loadDiaryForDate);
    } else {
        console.error('일기 날짜 입력을 찾을 수 없습니다.');
    }
    
    // 음식 추가
    const addFoodBtn = document.getElementById('addFood');
    if (addFoodBtn) {
        console.log('음식 추가 버튼 이벤트 등록');
        addFoodBtn.addEventListener('click', addFood);
        addFoodBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            console.log('음식 추가 터치 이벤트');
            addFood();
        });
    } else {
        console.error('음식 추가 버튼을 찾을 수 없습니다.');
    }
    
    const foodInput = document.getElementById('foodInput');
    if (foodInput) {
        foodInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addFood();
            }
        });
    } else {
        console.error('음식 입력창을 찾을 수 없습니다.');
    }
    
    // 팝업 관련
    const hideFor7DaysBtn = document.getElementById('hideFor7Days');
    if (hideFor7DaysBtn) {
        hideFor7DaysBtn.addEventListener('click', () => hideWelcomePopup(7));
        hideFor7DaysBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            hideWelcomePopup(7);
        });
    }
    
    const hideForeverBtn = document.getElementById('hideForever');
    if (hideForeverBtn) {
        hideForeverBtn.addEventListener('click', () => hideWelcomePopup(-1));
        hideForeverBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            hideWelcomePopup(-1);
        });
    }
    
    const installAppBtn = document.getElementById('installApp');
    if (installAppBtn) {
        installAppBtn.addEventListener('click', installPWA);
        installAppBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            installPWA();
        });
    }
    
    const closeReminderBtn = document.getElementById('closeReminder');
    if (closeReminderBtn) {
        closeReminderBtn.addEventListener('click', closeReminderPopup);
        closeReminderBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeReminderPopup();
        });
    }
    
    // 임신 기준일 설정
    const savePregnancyDateBtn = document.getElementById('savePregnancyDate');
    if (savePregnancyDateBtn) {
        savePregnancyDateBtn.addEventListener('click', savePregnancyDate);
        savePregnancyDateBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            savePregnancyDate();
        });
    }
    
    const editPregnancyDateBtn = document.getElementById('editPregnancyDate');
    if (editPregnancyDateBtn) {
        editPregnancyDateBtn.addEventListener('click', showPregnancyDatePopup);
        editPregnancyDateBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            showPregnancyDatePopup();
        });
    }
    
    // 알림 권한 관련
    const enableNotificationsBtn = document.getElementById('enableNotifications');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.addEventListener('click', enableNotifications);
        enableNotificationsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            enableNotifications();
        });
    }
    
    const skipNotificationsBtn = document.getElementById('skipNotifications');
    if (skipNotificationsBtn) {
        skipNotificationsBtn.addEventListener('click', skipNotifications);
        skipNotificationsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            skipNotifications();
        });
    }
    
    // 차트 관련
    const showStatsPopupBtn = document.getElementById('showStatsPopup');
    if (showStatsPopupBtn) {
        console.log('통계 팝업 버튼 이벤트 등록');
        showStatsPopupBtn.addEventListener('click', showStatsPopup);
        showStatsPopupBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            console.log('통계 팝업 터치 이벤트');
            showStatsPopup();
        });
    } else {
        console.error('통계 팝업 버튼을 찾을 수 없습니다.');
    }
    
    const closeStatsBtn = document.getElementById('closeStats');
    if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', closeStatsPopup);
        closeStatsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeStatsPopup();
        });
    }
    
    const showChartBtn = document.getElementById('showChart');
    if (showChartBtn) {
        showChartBtn.addEventListener('click', showMovementChart);
        showChartBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            showMovementChart();
        });
    }
    
    // 추천 음식 관련
    const showRecommendationBtn = document.getElementById('showRecommendation');
    if (showRecommendationBtn) {
        console.log('추천 음식 버튼 이벤트 등록');
        showRecommendationBtn.addEventListener('click', showRecommendationPopup);
        showRecommendationBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            console.log('추천 음식 터치 이벤트');
            showRecommendationPopup();
        });
    } else {
        console.error('추천 음식 버튼을 찾을 수 없습니다.');
    }
    
    const closeRecommendationBtn = document.getElementById('closeRecommendation');
    if (closeRecommendationBtn) {
        closeRecommendationBtn.addEventListener('click', closeRecommendationPopup);
        closeRecommendationBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeRecommendationPopup();
        });
    }
    
    // 설정 관련
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettingsPopup);
        settingsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            showSettingsPopup();
        });
    }
    
    const closeSettingsBtn = document.getElementById('closeSettings');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsPopup);
        closeSettingsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeSettingsPopup();
        });
    }
    
    const resetNotificationBtn = document.getElementById('resetNotificationSettings');
    if (resetNotificationBtn) {
        resetNotificationBtn.addEventListener('click', resetNotificationSettings);
        resetNotificationBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            resetNotificationSettings();
        });
    }
    
    const resetWelcomeBtn = document.getElementById('resetWelcomePopup');
    if (resetWelcomeBtn) {
        resetWelcomeBtn.addEventListener('click', resetWelcomePopup);
        resetWelcomeBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            resetWelcomePopup();
        });
    }
    
    console.log('이벤트 리스너 설정 완료');
}

// 날짜 키 생성 함수들
function getTodayKey() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

// 임신 기준일 저장
function savePregnancyDate() {
    const dateInput = document.getElementById('pregnancyStartDate');
    const selectedDate = dateInput.value;
    
    if (!selectedDate) {
        alert('날짜를 선택해주세요.');
        return;
    }
    
    localStorage.setItem('pregnancyStartDate', selectedDate);
    document.getElementById('pregnancyDatePopup').classList.remove('show');
    updateDateAndWeek();
}

// 태동 기록 함수
function recordMovement() {
    console.log('태동 기록 함수 실행');
    const dateKey = getTodayKey();
    const currentCount = parseInt(localStorage.getItem(`movement_${dateKey}`) || 0);
    const newCount = currentCount + 1;
    
    try {
        localStorage.setItem(`movement_${dateKey}`, newCount);
        const countElement = document.getElementById('movementCount');
        if (countElement) {
            countElement.textContent = newCount;
            console.log('태동 기록 업데이트:', newCount);
        }
    } catch (error) {
        console.error('태동 기록 저장 오류:', error);
        alert('태동 기록 저장에 실패했습니다.');
        return;
    }
    
    // 버튼 애니메이션
    const button = document.getElementById('recordMovement');
    if (button) {
        button.classList.add('recording');
        setTimeout(() => {
            button.classList.remove('recording');
        }, 600);
    }
    
    // 햅틱 피드백
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    
    console.log('태동 기록 완료');
}

// 일기 관련 함수들
function setupDiary() {
    const diaryDateInput = document.getElementById('diaryDate');
    const today = new Date();
    
    // 오늘 날짜로 초기화 (텍스트 형태로)
    const todayFormatted = today.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
    diaryDateInput.value = todayFormatted;
    diaryDateInput.dataset.dateValue = today.toISOString().split('T')[0];
    
    // 달력 초기화
    initializeDiaryCalendar();
    
    // 날짜 입력창 클릭 시 커스텀 달력만 표시
    diaryDateInput.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleDiaryCalendar();
    });
    
    // 포커스 방지
    diaryDateInput.addEventListener('focus', function(e) {
        e.preventDefault();
        this.blur();
    });
    
    // 모든 입력 방지
    diaryDateInput.addEventListener('keydown', function(e) {
        e.preventDefault();
        return false;
    });
    
    diaryDateInput.addEventListener('input', function(e) {
        e.preventDefault();
        return false;
    });
    
    // 달력 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        const calendar = document.getElementById('diaryCalendar');
        const container = document.querySelector('.diary-calendar-container');
        
        if (!container.contains(e.target)) {
            calendar.classList.remove('show');
        }
    });
    
    // 오늘 일기 로드
    loadDiaryForDate();
}

function loadDiaryForDate() {
    const diaryDateInput = document.getElementById('diaryDate');
    const selectedDate = diaryDateInput.dataset.dateValue;
    const diaryContent = document.getElementById('diaryContent');
    const diaryTitle = document.getElementById('diaryTitle');
    
    if (!selectedDate) return;
    
    // 제목 업데이트
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
    
    diaryTitle.textContent = `👶 ${formattedDate} 우리 아기 일기`;
    
    // 해당 날짜의 일기 내용 로드
    const diaryKey = `diary_${selectedDate}`;
    const savedDiary = localStorage.getItem(diaryKey) || '';
    diaryContent.value = savedDiary;
}

function saveDiary() {
    console.log('일기 저장 함수 실행');
    const diaryDateInput = document.getElementById('diaryDate');
    const diaryContent = document.getElementById('diaryContent');
    
    if (!diaryDateInput || !diaryContent) {
        console.error('일기 요소를 찾을 수 없습니다.');
        alert('일기 저장에 실패했습니다.');
        return;
    }
    
    const selectedDate = diaryDateInput.value;
    const dateValue = diaryDateInput.dataset.dateValue;
    const content = diaryContent.value ? diaryContent.value.trim() : '';
    
    if (!dateValue) {
        alert('날짜를 선택해주세요.');
        return;
    }
    
    try {
        const diaryKey = `diary_${dateValue}`;
        localStorage.setItem(diaryKey, content);
        console.log('일기 저장 완료:', diaryKey, content.length + '글자');
    } catch (error) {
        console.error('일기 저장 오류:', error);
        alert('일기 저장에 실패했습니다.');
        return;
    }
    
    // 저장 완료 피드백
    const button = document.getElementById('saveDiary');
    if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '💝 저장완료!';
        button.classList.add('saved');
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('saved');
            
            // 달력 업데이트 (일기 작성 표시)
            updateCalendarDiaryIndicators();
        }, 2500);
    }
    
    // 햅틱 피드백
    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
}

// 달력 관련 함수들
let currentCalendarDate = new Date();

function initializeDiaryCalendar() {
    currentCalendarDate = new Date();
    renderDiaryCalendar();
    
    // 달력 네비게이션 이벤트
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderDiaryCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderDiaryCalendar();
    });
}

function toggleDiaryCalendar() {
    const calendar = document.getElementById('diaryCalendar');
    const isVisible = calendar.classList.contains('show');
    
    if (isVisible) {
        calendar.classList.remove('show');
    } else {
        // 현재 선택된 날짜로 달력 이동
        const selectedDate = document.getElementById('diaryDate').value;
        if (selectedDate) {
            currentCalendarDate = new Date(selectedDate);
        }
        renderDiaryCalendar();
        calendar.classList.add('show');
    }
}

function renderDiaryCalendar() {
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', 
                       '7월', '8월', '9월', '10월', '11월', '12월'];
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 월 표시
    document.getElementById('currentMonth').textContent = `${year}년 ${monthNames[month]}`;
    
    // 달력 날짜 생성
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 자정으로 정규화
    const diaryDateInput = document.getElementById('diaryDate');
    const selectedDate = diaryDateInput.dataset.dateValue;
    
    // 42일 (6주 × 7일) 달력 생성
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();
        
        const dateKey = date.toISOString().split('T')[0];
        
        // 다른 월 날짜
        if (date.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }
        
        // 오늘 날짜
        if (date.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }
        
        // 선택된 날짜
        if (dateKey === selectedDate) {
            dayElement.classList.add('selected');
        }
        
        // 일기 작성 여부 확인
        const diaryContent = localStorage.getItem(`diary_${dateKey}`);
        if (diaryContent && diaryContent.trim() !== '') {
            dayElement.classList.add('has-diary');
        }
        
        // 클릭 이벤트
        dayElement.addEventListener('click', () => {
            const formattedDate = date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
            
            diaryDateInput.value = formattedDate;
            diaryDateInput.dataset.dateValue = dateKey;
            loadDiaryForDate();
            document.getElementById('diaryCalendar').classList.remove('show');
        });
        
        calendarDays.appendChild(dayElement);
    }
}

function updateCalendarDiaryIndicators() {
    // 달력이 열려있으면 업데이트
    const calendar = document.getElementById('diaryCalendar');
    if (calendar.classList.contains('show')) {
        renderDiaryCalendar();
    }
}

// 음식 추가
function addFood() {
    console.log('음식 추가 함수 실행');
    const foodInput = document.getElementById('foodInput');
    
    if (!foodInput) {
        console.error('음식 입력창을 찾을 수 없습니다.');
        alert('음식 추가에 실패했습니다.');
        return;
    }
    
    const foodName = foodInput.value ? foodInput.value.trim() : '';
    
    if (!foodName) {
        alert('음식 이름을 입력해주세요.');
        return;
    }
    
    const dateKey = getTodayKey();
    const now = new Date();
    const time = now.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const foodData = {
        name: foodName,
        time: time,
        timestamp: now.getTime()
    };
    
    try {
        // 기존 음식 목록 가져오기
        const existingFoods = JSON.parse(localStorage.getItem(`food_${dateKey}`) || '[]');
        existingFoods.push(foodData);
        
        localStorage.setItem(`food_${dateKey}`, JSON.stringify(existingFoods));
        console.log('음식 추가 완료:', foodName);
        
        // 입력창 초기화 및 목록 새로고침
        foodInput.value = '';
        loadFoodList(dateKey);
    } catch (error) {
        console.error('음식 추가 오류:', error);
        alert('음식 추가에 실패했습니다.');
    }
    
}

// 음식 목록 로드
function loadFoodList(dateKey = null) {
    if (!dateKey) {
        dateKey = getDateKey(currentSelectedDate);
    }
    
    const foods = JSON.parse(localStorage.getItem(`food_${dateKey}`) || '[]');
    const foodListElement = document.getElementById('foodList');
    const isToday = dateKey === getTodayKey();
    
    if (foods.length === 0) {
        foodListElement.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">기록된 음식이 없습니다.</p>';
        return;
    }
    
    foodListElement.innerHTML = foods.map((food, index) => `
        <div class="food-item">
            <div class="food-item-content">
                <div class="food-name">${food.name}</div>
                <div class="food-time">${food.time}</div>
            </div>
            ${isToday ? `<button class="delete-food" onclick="deleteFood(${index}, '${dateKey}')">삭제</button>` : ''}
        </div>
    `).join('');
}

// 음식 삭제
function deleteFood(index, dateKey) {
    const foods = JSON.parse(localStorage.getItem(`food_${dateKey}`) || '[]');
    
    foods.splice(index, 1);
    localStorage.setItem(`food_${dateKey}`, JSON.stringify(foods));
    
    loadFoodList(dateKey);
}

// 통계 팝업 표시
function showStatsPopup() {
    console.log('통계 팝업 표시 함수 실행');
    const popup = document.getElementById('statsPopup');
    if (popup) {
        popup.classList.add('show');
        console.log('통계 팝업 표시 완료');
    } else {
        console.error('통계 팝업 요소를 찾을 수 없습니다.');
        alert('통계를 표시할 수 없습니다.');
    }
}

// 통계 팝업 닫기
function closeStatsPopup() {
    const popup = document.getElementById('statsPopup');
    popup.classList.remove('show');
}

// 차트 컨트롤 설정
function setupChartControls() {
    const monthInput = document.getElementById('chartMonth');
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM 형식
    monthInput.value = currentMonth;
}

// 태동 기록 차트 표시
function showMovementChart() {
    const monthInput = document.getElementById('chartMonth');
    const selectedMonth = monthInput.value; // YYYY-MM 형식
    
    if (!selectedMonth) {
        alert('월을 선택해주세요.');
        return;
    }
    
    const chartData = getMovementDataForMonth(selectedMonth);
    renderMovementChart(chartData, selectedMonth);
    showChartStats(chartData);
}

// 특정 월의 태동 데이터 수집
function getMovementDataForMonth(yearMonth) {
    const [year, month] = yearMonth.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    const data = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${yearMonth}-${day.toString().padStart(2, '0')}`;
        const count = parseInt(localStorage.getItem(`movement_${dateKey}`) || 0);
        data.push({
            day: day,
            count: count,
            date: dateKey
        });
    }
    
    return data;
}

// 차트 렌더링
function renderMovementChart(data, yearMonth) {
    const ctx = document.getElementById('movementChart').getContext('2d');
    const chartContainer = document.getElementById('chartContainer');
    
    // 기존 차트 제거
    if (movementChart) {
        movementChart.destroy();
    }
    
    const labels = data.map(item => `${item.day}일`);
    const counts = data.map(item => item.count);
    
    movementChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '태동 횟수',
                data: counts,
                backgroundColor: 'rgba(255, 105, 180, 0.6)',
                borderColor: 'rgba(255, 105, 180, 1)',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${yearMonth} 태동 기록`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#333'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#666'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#666',
                        maxRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const selectedData = data[index];
                    const count = selectedData.count;
                    const date = selectedData.date;
                    
                    if (count > 0) {
                        alert(`${date}: ${count}회 태동 기록`);
                    }
                }
            }
        }
    });
    
    // 차트 컨테이너 표시
    chartContainer.classList.add('show');
}

// 차트 통계 표시
function showChartStats(data) {
    const statsContainer = document.getElementById('chartStats');
    
    const totalCount = data.reduce((sum, item) => sum + item.count, 0);
    const daysWithData = data.filter(item => item.count > 0).length;
    const averageCount = daysWithData > 0 ? (totalCount / daysWithData).toFixed(1) : 0;
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <div class="stat-label">총 태동 횟수</div>
            <div class="stat-value">${totalCount}<span class="stat-unit">회</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-label">하루 평균</div>
            <div class="stat-value">${averageCount}<span class="stat-unit">회</span></div>
        </div>
    `;
    
    statsContainer.classList.add('show');
}

// 환영 팝업 관련 함수들
function checkWelcomePopup() {
    const hideUntil = localStorage.getItem('welcomePopupHideUntil');
    const neverShow = localStorage.getItem('welcomePopupNeverShow');
    
    if (neverShow === 'true') return;
    
    if (hideUntil) {
        const hideDate = new Date(hideUntil);
        if (new Date() < hideDate) return;
    }
    
    showWelcomePopup();
}

function showWelcomePopup() {
    const popup = document.getElementById('welcomePopup');
    popup.classList.add('show');
}

function hideWelcomePopup(days) {
    const popup = document.getElementById('welcomePopup');
    popup.classList.remove('show');
    
    if (days === -1) {
        localStorage.setItem('welcomePopupNeverShow', 'true');
    } else if (days > 0) {
        const hideUntil = new Date();
        hideUntil.setDate(hideUntil.getDate() + days);
        localStorage.setItem('welcomePopupHideUntil', hideUntil.toISOString());
    }
}

// 리마인더 팝업 관련 함수들
function checkReminderPopup() {
    const today = getTodayKey();
    const lastReminder = localStorage.getItem('lastReminderDate');
    
    if (lastReminder === today) return;
    
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 10 && hour < 12) {
        setTimeout(() => {
            showReminderPopup();
        }, 3000);
    }
}

function showReminderPopup() {
    const today = getTodayKey();
    const movementCount = parseInt(localStorage.getItem(`movement_${today}`) || 0);
    
    let message = '';
    if (movementCount === 0) {
        message = '오늘 태동 기록하셨나요? 👶';
    } else {
        message = `오늘 ${movementCount}회 태동을 기록하셨네요! 건강 메모도 작성해보세요 📝`;
    }
    
    document.getElementById('reminderMessage').textContent = message;
    document.getElementById('reminderPopup').classList.add('show');
}

function closeReminderPopup() {
    const popup = document.getElementById('reminderPopup');
    popup.classList.remove('show');
    
    const today = getTodayKey();
    localStorage.setItem('lastReminderDate', today);
}

// PWA 설치 관련 함수들
function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });
}

function installPWA() {
    hideWelcomePopup(-1);
    
    if (deferredPrompt) {
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
        });
    } else {
        alert('홈 화면에 추가하려면:\n\n1. 브라우저 메뉴(⋯)를 열어주세요\n2. "홈 화면에 추가" 또는 "바로가기 추가"를 선택해주세요');
    }
}

// Push 알림 관련 함수들
function requestNotificationPermission() {
    // 이미 권한을 요청했거나 거부했으면 팝업 표시하지 않음
    const notificationStatus = localStorage.getItem('notificationStatus');
    if (notificationStatus) return;
    
    // 환영 팝업이 끝난 후 알림 권한 요청
    setTimeout(() => {
        if (!document.getElementById('welcomePopup').classList.contains('show')) {
            showNotificationPopup();
        }
    }, 5000);
}

function showNotificationPopup() {
    const popup = document.getElementById('notificationPopup');
    popup.classList.add('show');
}

function enableNotifications() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                localStorage.setItem('notificationStatus', 'granted');
                scheduleNotifications();
                alert('알림이 설정되었습니다! 매일 오전 10시에 알림을 받으실 수 있습니다.');
            } else {
                localStorage.setItem('notificationStatus', 'denied');
            }
        });
    }
    document.getElementById('notificationPopup').classList.remove('show');
}

function skipNotifications() {
    localStorage.setItem('notificationStatus', 'skipped');
    document.getElementById('notificationPopup').classList.remove('show');
}

function setupPushNotifications(registration) {
    if ('PushManager' in window && 'Notification' in window) {
        // Push 알림 설정 로직
        console.log('Push notifications are supported');
    }
}

function scheduleNotifications() {
    // 실제 프로덕션에서는 서버에서 Push 알림을 보내야 합니다.
    // 여기서는 로컬 알림 스케줄링 예시입니다.
    
    if ('serviceWorker' in navigator && 'Notification' in window) {
        navigator.serviceWorker.ready.then(registration => {
            // 매일 오전 10시에 알림을 보내는 로직
            const now = new Date();
            const scheduledTime = new Date();
            scheduledTime.setHours(10, 0, 0, 0);
            
            // 오늘 10시가 이미 지났으면 내일로 설정
            if (now > scheduledTime) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }
            
            const timeUntilNotification = scheduledTime.getTime() - now.getTime();
            
            setTimeout(() => {
                if (Notification.permission === 'granted') {
                    registration.showNotification('임산부 케어 도우미', {
                        body: '오늘 태동 기록하셨나요? 👶',
                        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤱</text></svg>',
                        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤱</text></svg>',
                        vibrate: [100, 50, 100],
                        data: {
                            url: '/'
                        }
                    });
                }
                
                // 다음 날 알림 스케줄링
                scheduleNotifications();
            }, timeUntilNotification);
        });
    }
}

// 추천 음식 데이터
const foodRecommendations = {
    1: [ // 1월 (임신 초기)
        {
            name: "🥬 시금치",
            description: "철분과 엽산이 풍부해 빈혈 예방과 태아의 신경관 발달에 도움을 줍니다",
            intake: "1일 1회, 100g 정도 (나물이나 국으로 조리)",
            caution: "충분히 씻어서 조리하고, 과량 섭취 시 신장 결석 위험이 있으니 적당량 섭취하세요"
        },
        {
            name: "🐟 고등어",
            description: "DHA와 오메가-3가 풍부해 태아의 두뇌 발달과 시력 발달에 도움을 줍니다",
            intake: "1주일에 2-3회, 1회 80-100g",
            caution: "신선한 것으로 충분히 익혀서 드시고, 수은 함량이 낮은 소형 어류를 선택하세요"
        },
        {
            name: "🥑 아보카도",
            description: "엽산, 칼륨, 건강한 지방이 풍부해 태아 발달과 임산부 건강에 좋습니다",
            intake: "1일 1/2개 정도",
            caution: "칼로리가 높으므로 과량 섭취하지 마시고, 잘 익은 것을 선택하세요"
        },
        {
            name: "🥛 우유",
            description: "칼슘과 단백질이 풍부해 태아의 뼈와 치아 형성에 필수적입니다",
            intake: "1일 2-3잔 (200ml씩)",
            caution: "유당불내증이 있다면 락토프리 제품을 선택하고, 저온살균 제품을 드세요"
        }
    ],
    2: [ // 2월
        {
            name: "🍊 오렌지",
            description: "비타민C와 엽산이 풍부해 면역력 강화와 태아 발달에 도움을 줍니다",
            intake: "1일 1-2개",
            caution: "당분이 많으므로 적당량 섭취하고, 공복에는 피하세요"
        },
        {
            name: "🍗 닭가슴살",
            description: "고품질 단백질과 비타민B가 풍부해 태아 성장과 임산부 체력 유지에 좋습니다",
            intake: "1일 100-150g",
            caution: "충분히 익혀서 드시고, 껍질 부분은 지방이 많으니 제거 후 섭취하세요"
        },
        {
            name: "🍠 고구마",
            description: "베타카로틴과 식이섬유가 풍부해 변비 예방과 태아 발달에 도움을 줍니다",
            intake: "1일 1개 (중간 크기)",
            caution: "당분이 있으므로 적당량 섭취하고, 충분히 익혀서 드세요"
        }
    ]
    // 필요에 따라 다른 월도 추가 가능
};

// 추천 음식 팝업 표시
function showRecommendationPopup() {
    try {
        console.log('추천 음식 팝업 표시 함수 실행');
        const currentMonth = new Date().getMonth() + 1; // 1-12월
        const recommendations = foodRecommendations[currentMonth] || foodRecommendations[1];
        
        const titleElement = document.getElementById('recommendationTitle');
        const contentElement = document.getElementById('recommendationContent');
        
        if (!titleElement || !contentElement) {
            console.error('추천 음식 팝업 내부 요소를 찾을 수 없습니다.');
            alert('추천 음식을 표시할 수 없습니다.');
            return;
        }
        
        titleElement.textContent = `${currentMonth}월 추천 음식`;
        
        contentElement.innerHTML = recommendations.map(food => `
            <div class="food-recommendation">
                <div class="food-name">${food.name}</div>
                <div class="food-description">${food.description}</div>
                <div class="food-details">
                    <div class="food-detail-item">
                        <span class="detail-label">권장량:</span>
                        <span class="detail-value">${food.intake}</span>
                    </div>
                    <div class="food-detail-item">
                        <span class="detail-label">주의사항:</span>
                        <span class="detail-value">${food.caution}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        const popup = document.getElementById('recommendationPopup');
        if (popup) {
            popup.classList.add('show');
            console.log('추천 음식 팝업 표시 완료');
        } else {
            console.error('추천 음식 팝업 요소를 찾을 수 없습니다');
        }
    } catch (error) {
        console.error('추천 음식 팝업 표시 오류:', error);
        alert('추천 음식을 표시하는 중 오류가 발생했습니다.');
    }
}

// 추천 음식 팝업 닫기
function closeRecommendationPopup() {
    document.getElementById('recommendationPopup').classList.remove('show');
}

// 설정 팝업 관련 함수들
function showSettingsPopup() {
    document.getElementById('settingsPopup').classList.add('show');
}

function closeSettingsPopup() {
    document.getElementById('settingsPopup').classList.remove('show');
}

function resetNotificationSettings() {
    localStorage.removeItem('notificationStatus');
    closeSettingsPopup();
    setTimeout(() => {
        showNotificationPopup();
    }, 500);
}

function resetWelcomePopup() {
    localStorage.removeItem('welcomePopupNeverShow');
    localStorage.removeItem('welcomePopupHideUntil');
    closeSettingsPopup();
    setTimeout(() => {
        showWelcomePopup();
    }, 500);
}

// 페이지 로드 애니메이션
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
    });
});

// 온라인/오프라인 상태 감지
window.addEventListener('online', () => {
    console.log('온라인 상태가 되었습니다.');
});

window.addEventListener('offline', () => {
    console.log('오프라인 상태입니다.');
});