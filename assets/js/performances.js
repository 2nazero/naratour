// assets/js/performances.js
// 전역 변수들
let currentPerformances = [];
let currentRecommendations = [];
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;
let isLoading = false;
let userLocation = null;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
  console.log('performances.js 로드됨');
  
  // 날짜 선택기 초기화
  initDatePicker();
  
  // 사용자 위치 정보 가져오기 시도
  getUserLocation();
  
  // 초기 공연 데이터 로드
  loadPerformances();

  // 필터 폼 이벤트 리스너
  const filterForm = document.getElementById('performance-filter-form');
  if (filterForm) {
    filterForm.addEventListener('submit', function(event) {
      event.preventDefault();
      filterPerformances();
    });
  }

  // AI 추천 버튼 이벤트 리스너
  const aiRecommendButton = document.getElementById('get-ai-recommendations');
  if (aiRecommendButton) {
    aiRecommendButton.addEventListener('click', function() {
      const keywordInput = document.getElementById('keyword-input');
      const keyword = keywordInput ? keywordInput.value.trim() : '';
      
      if (!keyword) {
        showAlert('키워드를 입력해주세요.', 'warning');
        return;
      }
      
      // 현재 선택된 지역과 유형 가져오기
      const region = document.getElementById('region').value;
      const performanceType = document.getElementById('performance-type').value;
      
      // 키워드를 포함하여 추천 요청
      getAIRecommendations(region, performanceType, keyword);
    });
  }

  // 더 보기 버튼 이벤트 리스너
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMorePerformances);
  }
  
  // 태그 클릭 이벤트 리스너
  document.querySelectorAll('.tag-badge').forEach(tag => {
    tag.addEventListener('click', function() {
      const tagText = this.getAttribute('data-tag');
      
      // 태그 활성화/비활성화 토글
      this.classList.toggle('active-tag');
      
      // 활성화된 상태에서는 필터링, 비활성화된 상태에서는 전체 목록으로
      if (this.classList.contains('active-tag')) {
        // 키워드로 AI 추천 호출
        const keywordInput = document.getElementById('keyword-input');
        keywordInput.value = tagText;
        getAIRecommendations('', '', tagText);
      } else {
        // 전체 목록으로 초기화
        loadPerformances();
      }
    });
  });
  
  // 태그 새로고침 버튼
  document.getElementById('refresh-tags').addEventListener('click', refreshPopularTags);
  
  // 정렬 옵션 변경 이벤트
  document.getElementById('sort-by').addEventListener('change', function() {
    sortPerformances(this.value);
  });
  
  // 빠른 날짜 선택 버튼
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      selectQuickDate(this.getAttribute('data-period'));
    });
  });

  // 최신 공연 소식 로드
  loadLatestNews();
  
  console.log('DOMContentLoaded 이벤트 발생');
});

// 사용자 위치 정보 가져오기
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      // 성공 콜백
      (position) => {
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log('사용자 위치 정보 획득:', userLocation);
      },
      // 실패 콜백
      (error) => {
        console.warn('위치 정보를 가져올 수 없습니다:', error.message);
        // 기본 위치 설정 (서울)
        userLocation = { latitude: 37.5665, longitude: 126.9780 };
      },
      // 옵션
      { timeout: 10000, enableHighAccuracy: false }
    );
  } else {
    console.warn('브라우저가 위치 정보를 지원하지 않습니다.');
    // 기본 위치 설정 (서울)
    userLocation = { latitude: 37.5665, longitude: 126.9780 };
  }
}

// 날짜 선택기 초기화
function initDatePicker() {
  const dateRangePicker = flatpickr("#date-range", {
    mode: "range",
    locale: "ko",
    dateFormat: "Y-m-d",
    minDate: "today",
    maxDate: new Date().fp_incr(365), // 오늘부터 1년 후까지
    placeholder: "공연 날짜 범위 선택",
    altInput: true,
    altFormat: "Y년 m월 d일",
    rangeSeparator: " ~ "
  });
  
  // 날짜 초기화 버튼
  document.getElementById('clear-date').addEventListener('click', function() {
    dateRangePicker.clear();
  });
  
  // 전역에서 사용할 수 있도록 저장
  window.dateRangePicker = dateRangePicker;
}

// 빠른 날짜 선택
function selectQuickDate(period) {
  // 날짜 선택기 가져오기
  const dateRangePicker = window.dateRangePicker;
  if (!dateRangePicker) return;
  
  // 현재 날짜
  const today = new Date();
  
  // 버튼 활성화 상태 전환
  document.querySelectorAll('.quick-date-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // 선택된 버튼 활성화
  document.querySelector(`.quick-date-btn[data-period="${period}"]`).classList.add('active');
  
  let startDate, endDate;
  
  switch (period) {
    case 'today':
      startDate = today;
      endDate = today;
      break;
    case 'tomorrow':
      startDate = new Date(today);
      startDate.setDate(today.getDate() + 1);
      endDate = new Date(startDate);
      break;
    case 'weekend':
      // 현재 요일 (0: 일요일, 1: 월요일, ..., 6: 토요일)
      const dayOfWeek = today.getDay();
      
      // 다음 토요일 찾기
      const daysUntilSaturday = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
      const nextSaturday = new Date(today);
      nextSaturday.setDate(today.getDate() + daysUntilSaturday);
      
      // 다음 일요일 찾기
      const nextSunday = new Date(nextSaturday);
      nextSunday.setDate(nextSaturday.getDate() + 1);
      
      startDate = nextSaturday;
      endDate = nextSunday;
      break;
    case 'week':
      // 오늘부터 7일
      startDate = today;
      endDate = new Date(today);
      endDate.setDate(today.getDate() + 6);
      break;
    default:
      return;
  }
  
  // 날짜 선택기 업데이트
  dateRangePicker.setDate([startDate, endDate]);
  
  // 필터링 적용
  filterPerformances();
}

// 공연 정보 로드
async function loadPerformances() {
  console.log('공연 정보 로드 시작...');
  const performancesContainer = document.getElementById('performances-container');
  
  // 페이지 초기화
  currentPage = 1;
  
  // 로딩 표시
  showLoading(performancesContainer, '공연 정보를 불러오는 중...');
  
  try {
    // API 호출 시도
    try {
      console.log('Netlify 함수 호출 시작...');
      const response = await fetch('https://5qdo7ypczighz5qhtaqzm44eb40vaahr.lambda-url.us-east-1.on.aws');
      
      console.log('응답 상태:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('받은 데이터 타입:', typeof data);
        
        // 새로운 응답 구조 처리 (pagination 포함)
        let performances = [];
        let pagination = null;
        let stats = null;
        
        if (data.performances) {
          // 새 구조: { performances: [...], pagination: {...}, stats: {...} }
          performances = data.performances;
          pagination = data.pagination;
          stats = data.stats;
        } else if (Array.isArray(data)) {
          // 이전 구조: 배열 형태
          performances = data;
        } else {
          console.error('예상치 못한 응답 형식:', data);
          throw new Error('유효하지 않은 응답 형식');
        }
        
        console.log('받은 공연 데이터 수:', performances.length);
        if (pagination) {
          console.log('페이지네이션 정보:', pagination);
          currentPage = pagination.currentPage || 1;
          totalPages = pagination.totalPages || 1;
          totalCount = pagination.totalCount || performances.length;
        }
        
        // 검색 통계 업데이트
        if (stats) {
          updateSearchStats(stats);
        }
        
        // 첫 번째 항목 샘플 로그
        if (performances.length > 0) {
          console.log('첫 번째 항목 샘플:', JSON.stringify(performances[0]).substring(0, 150));
        }
        
        // 데이터 소스 확인
        const isRealData = performances.length > 0 && performances[0].source === "한국관광공사";
        console.log('실제 API 데이터 여부:', isRealData);
        
        // 공연 정보 저장 및 표시
        currentPerformances = performances;
        displayPerformances(performances, true); // true는 초기 로드를 의미
        
        // "더 보기" 버튼 상태 업데이트
        updateLoadMoreButton();
        
        // 태그 리스트 업데이트
        refreshPopularTags();
        
        // 성공 메시지
        if (isRealData) {
          showAlert(`${performances.length}개의 공연 정보를 불러왔습니다.`, 'success');
        } else {
          showAlert(`API 연결 실패로 ${performances.length}개의 샘플 데이터를 표시합니다.`, 'warning');
        }
        return;
      } else {
        const errorData = await response.text();
        console.error('API 응답 오류:', response.status, errorData);
        throw new Error('서버 응답 오류: ' + response.status);
      }
    } catch (apiError) {
      console.error('API 호출 오류:', apiError);
      // API 호출 실패 시 계속 진행하여 샘플 데이터 사용
    }
    
    // API 호출 실패 시 샘플 데이터 표시
    currentPerformances = generateSamplePerformances();
    displayPerformances(currentPerformances, true);
    updateLoadMoreButton(false); // 샘플 데이터에서는 더 보기 버튼 비활성화
    showAlert('API 연결 오류로 샘플 데이터를 표시합니다.', 'warning');
  } catch (error) {
    console.error('공연 정보를 불러오는 중 오류가 발생했습니다:', error);
    
    // 오류 발생 시 샘플 데이터 표시
    currentPerformances = generateSamplePerformances();
    displayPerformances(currentPerformances, true);
    updateLoadMoreButton(false); // 샘플 데이터에서는 더 보기 버튼 비활성화
    showAlert('오류가 발생하여 샘플 데이터를 표시합니다.', 'warning');
  }
}

// 검색 통계 업데이트
function updateSearchStats(stats) {
  if (!stats) return;
  
  const statsContainer = document.getElementById('search-stats');
  if (!statsContainer) return;
  
  // 통계 표시
  document.getElementById('stats-total').textContent = stats.total || 0;
  document.getElementById('stats-regions').textContent = stats.regions || 0;
  document.getElementById('stats-types').textContent = stats.types || 0;
  document.getElementById('stats-month').textContent = stats.currentMonth || 0;
  
  // 통계 컨테이너 표시
  statsContainer.classList.remove('d-none');
}

// 추가 공연 정보 로드 (더 보기 버튼)
async function loadMorePerformances() {
  // 이미 로딩 중이거나 마지막 페이지인 경우 중단
  if (isLoading || currentPage >= totalPages) return;
  
  // 로딩 상태 표시
  isLoading = true;
  const loadingMore = document.getElementById('loading-more');
  const loadMoreBtn = document.getElementById('load-more-btn');
  
  if (loadingMore) loadingMore.classList.remove('d-none');
  if (loadMoreBtn) loadMoreBtn.disabled = true;
  
  try {
    // 다음 페이지 번호
    const nextPage = currentPage + 1;
    
    // 지역 및 장르 필터 가져오기
    const region = document.getElementById('region')?.value || '';
    const genre = document.getElementById('performance-type')?.value || '';
    
    // 날짜 범위 가져오기
    const dateRange = document.getElementById('date-range')?.value || '';
    let startDate = '';
    let endDate = '';
    
    if (dateRange) {
      const dates = dateRange.split(' to ');
      startDate = dates[0];
      endDate = dates.length > 1 ? dates[1] : startDate;
    }
    
    // API 호출
    console.log(`다음 페이지(${nextPage}) 데이터 로드 시작...`);
    let url = `https://5qdo7ypczighz5qhtaqzm44eb40vaahr.lambda-url.us-east-1.on.aws?page=${nextPage}`;
    
    // 필터 파라미터 추가
    if (region) url += `&region=${encodeURIComponent(region)}`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      
      // 새로운 구조 처리
      let performances = [];
      let pagination = null;
      
      if (data.performances) {
        performances = data.performances;
        pagination = data.pagination;
      } else if (Array.isArray(data)) {
        performances = data;
      } else {
        throw new Error('유효하지 않은 응답 형식');
      }
      
      // 페이지네이션 정보 업데이트
      if (pagination) {
        currentPage = pagination.currentPage;
        totalPages = pagination.totalPages;
        totalCount = pagination.totalCount;
      } else {
        currentPage = nextPage;
      }
      
      console.log(`다음 페이지에서 ${performances.length}개의 항목 로드됨`);
      
      // 기존 데이터에 새 데이터 추가
      currentPerformances = [...currentPerformances, ...performances];
      
      // 추가 데이터 표시 (기존 데이터 유지)
      appendPerformances(performances);
      
      // 성공 메시지
      showAlert(`${performances.length}개의 추가 공연 정보를 불러왔습니다.`, 'success');
    } else {
      const errorData = await response.text();
      console.error('API 응답 오류:', response.status, errorData);
      showAlert('추가 데이터를 불러오는데 실패했습니다.', 'danger');
    }
  } catch (error) {
    console.error('추가 공연 정보를 불러오는 중 오류:', error);
    showAlert('추가 데이터를 불러오는데 실패했습니다.', 'danger');
  } finally {
    // 로딩 상태 해제
    isLoading = false;
    const loadingMore = document.getElementById('loading-more');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    if (loadingMore) loadingMore.classList.add('d-none');
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    
    // "더 보기" 버튼 상태 업데이트
    updateLoadMoreButton();
  }
}

// "더 보기" 버튼 상태 업데이트
function updateLoadMoreButton(show = true) {
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');
  
  if (!loadMoreContainer || !loadMoreBtn) return;
  
  // 버튼 표시 여부
  if (show) {
    loadMoreContainer.classList.remove('d-none');
  } else {
    loadMoreContainer.classList.add('d-none');
    return;
  }
  
  // 마지막 페이지인 경우 버튼 비활성화
  if (currentPage >= totalPages) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.classList.add('disabled');
    loadMoreBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>모든 공연을 불러왔습니다';
  } else {
    loadMoreBtn.disabled = false;
    loadMoreBtn.classList.remove('disabled');
    loadMoreBtn.innerHTML = '<i class="fas fa-plus-circle me-2"></i>더 많은 공연 보기';
  }
}

// AI 맞춤 추천 가져오기
async function getAIRecommendations(region, genre, keyword) {
  const performancesContainer = document.getElementById('performances-container');
  
  // 로딩 표시
  showLoading(performancesContainer, `키워드 "${keyword}"에 대한 맞춤 공연을 찾고 있습니다...`);
  
  try {
    // Netlify 함수 호출 
    const response = await fetch('https://qrym4ymi66xnihukrlezp24nci0qxbfa.lambda-url.us-east-1.on.aws', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        region: region,
        genre: genre,
        keyword: keyword,
        userLocation: userLocation // 사용자 위치 정보 추가
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('API 응답 오류:', response.status, errorData);
      throw new Error('서버 응답 오류: ' + response.status);
    }
    
    const data = await response.json();
    
    // 응답 데이터 형식에 따라 처리
    if (Array.isArray(data)) {
      console.log(`${data.length}개의 AI 추천 결과 받음`);
      currentRecommendations = data;
      displayPerformances(data, true); // 새로 표시 (기존 데이터 대체)
      
      // "더 보기" 버튼 숨김 (추천 결과에서는 페이지네이션 사용 안 함)
      updateLoadMoreButton(false);
      
      // 데이터 소스 확인
      const isRealData = data.length > 0 && data[0].source === "한국관광공사";
      if (isRealData) {
        showAlert(`"${keyword}" 키워드에 맞는 ${data.length}개의 공연을 찾았습니다.`, 'success');
      } else {
        showAlert(`"${keyword}" 관련 ${data.length}개의 추천 공연이 있습니다.`, 'info');
      }
    } else if (data.text) {
      displayTextRecommendations(data.text, keyword);
      updateLoadMoreButton(false); // 텍스트 응답에서도 더 보기 버튼 숨김
    } else {
      throw new Error('유효하지 않은 응답 형식');
    }
  } catch (error) {
    console.error('추천을 가져오는 중 오류가 발생했습니다:', error);
    
    // 로컬 데이터에서 키워드 필터링 시도
    const filteredResults = filterLocalData(currentPerformances, {
      region: region,
      genre: genre,
      keyword: keyword
    });
    
    if (filteredResults.length > 0) {
      currentRecommendations = filteredResults;
      displayPerformances(filteredResults, true);
      updateLoadMoreButton(false); // 로컬 필터링 결과에서도 더 보기 버튼 숨김
      showAlert(`로컬 데이터에서 "${keyword}" 관련 공연을 ${filteredResults.length}개 찾았습니다.`, 'info');
    } else {
      displayTextRecommendations(generateFallbackAIResponse(keyword, region, genre), keyword);
      updateLoadMoreButton(false); // 대체 텍스트에서도 더 보기 버튼 숨김
    }
  }
}

// 인기 태그 새로고침
function refreshPopularTags() {
  const tagsContainer = document.getElementById('tags-container');
  if (!tagsContainer) return;
  
  // 현재 공연 데이터에서 키워드 추출
  const keywords = extractKeywordsFromPerformances(currentPerformances);
  
  // 태그가 없으면 기본 태그 사용
  if (keywords.length === 0) {
    console.log('추출된 키워드가 없어 기본 태그 사용');
    return;
  }
  
  // 태그 컨테이너 비우기
  tagsContainer.innerHTML = '';
  
  // 태그 추가
  keywords.forEach(keyword => {
    const tagElement = document.createElement('span');
    tagElement.className = 'badge rounded-pill bg-light text-dark me-2 mb-2 py-2 px-3 tag-badge';
    tagElement.setAttribute('data-tag', keyword);
    tagElement.textContent = keyword;
    
    // 클릭 이벤트 추가
    tagElement.addEventListener('click', function() {
      this.classList.toggle('active-tag');
      
      if (this.classList.contains('active-tag')) {
        // 키워드 입력 필드에 설정
        const keywordInput = document.getElementById('keyword-input');
        if (keywordInput) keywordInput.value = keyword;
        
        // AI 추천 요청
        getAIRecommendations('', '', keyword);
      } else {
        // 전체 목록으로 초기화
        loadPerformances();
      }
    });
    
    tagsContainer.appendChild(tagElement);
  });
  
  console.log(`${keywords.length}개의 인기 태그가 새로고침됨`);
  
  // 태그에 애니메이션 효과 추가
  tagsContainer.querySelectorAll('.tag-badge').forEach((tag, index) => {
    setTimeout(() => {
      tag.style.opacity = 0;
      tag.style.transform = 'translateY(10px)';
      tag.style.transition = 'opacity 0.5s, transform 0.5s';
      
      setTimeout(() => {
        tag.style.opacity = 1;
        tag.style.transform = 'translateY(0)';
      }, 50);
    }, index * 50);
  });
}

// 공연 데이터에서 키워드 추출
function extractKeywordsFromPerformances(performances) {
  if (!performances || performances.length === 0) return [];
  
  // 모든 키워드 수집
  const allKeywords = [];
  performances.forEach(performance => {
    if (performance.keywords && Array.isArray(performance.keywords)) {
      allKeywords.push(...performance.keywords);
    }
    
    // 제목에서도 키워드 추출 시도
    if (performance.title) {
      const titleWords = performance.title.split(/\s+/).filter(word => word.length >= 2);
      allKeywords.push(...titleWords);
    }
  });
  
  // 키워드 빈도수 계산
  const keywordCounts = {};
  allKeywords.forEach(keyword => {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  });
  
  // 키워드 빈도수 기준 정렬
  const sortedKeywords = Object.keys(keywordCounts).sort((a, b) => 
    keywordCounts[b] - keywordCounts[a]
  );
  
  // 중복 제거 후 상위 8개 선택
  return [...new Set(sortedKeywords)].slice(0, 8);
}

// 공연 정렬
function sortPerformances(sortOption) {
  if (!currentPerformances || currentPerformances.length === 0) return;
  
  console.log(`정렬 옵션 적용: ${sortOption}`);
  
  let sortedPerformances = [...currentPerformances];
  
  // 정렬 옵션에 따라 정렬
  switch (sortOption) {
    case 'date_asc': // 날짜 빠른순
      sortedPerformances.sort((a, b) => {
        return compareDates(a.date, b.date);
      });
      break;
    case 'date_desc': // 날짜 늦은순
      sortedPerformances.sort((a, b) => {
        return compareDates(b.date, a.date);
      });
      break;
    case 'title_asc': // 이름 가나다순
      sortedPerformances.sort((a, b) => {
        return (a.title || '').localeCompare(b.title || '', 'ko');
      });
      break;
    case 'title_desc': // 이름 역순
      sortedPerformances.sort((a, b) => {
        return (b.title || '').localeCompare(a.title || '', 'ko');
      });
      break;
    case 'distance': // 거리순 (사용자 위치 필요)
      if (userLocation) {
        sortedPerformances.sort((a, b) => {
          return calculateDistanceScore(a) - calculateDistanceScore(b);
        });
      }
      break;
    default:
      break;
  }
  
  // 정렬된 결과 표시
  displayPerformances(sortedPerformances, true);
}

// 날짜 비교 함수
function compareDates(dateA, dateB) {
  // 날짜 형식이 "YYYY-MM-DD ~ YYYY-MM-DD" 또는 "YYYY-MM-DD"인 경우 처리
  
  // 시작 날짜 추출
  const startDateA = extractStartDate(dateA);
  const startDateB = extractStartDate(dateB);
  
  // 날짜를 비교할 수 없는 경우 0 반환
  if (!startDateA && !startDateB) return 0;
  if (!startDateA) return 1; // a가 날짜가 없으면 뒤로
  if (!startDateB) return -1; // b가 날짜가 없으면 앞으로
  
  // 날짜 비교
  return startDateA.getTime() - startDateB.getTime();
}

// 시작 날짜 추출 함수
function extractStartDate(dateString) {
  if (!dateString || dateString === '날짜 정보 없음') return null;
  
  // "YYYY-MM-DD ~ YYYY-MM-DD" 형식에서 첫 번째 날짜 추출
  const matches = dateString.match(/(\d{4}-\d{2}-\d{2})/);
  
  if (matches && matches[1]) {
    return new Date(matches[1]);
  }
  
  return null;
}

// 거리 점수 계산 (사용자 위치 기반)
function calculateDistanceScore(performance) {
  if (!userLocation || !performance.location) return Infinity;
  
  // 주소에서 좌표를 얻을 수는 없지만, 
  // 지역명이 포함되어 있다면 대략적인 거리 점수 반환
  const address = performance.location.toLowerCase();
  const region = performance.region ? performance.region.toLowerCase() : '';
  
  // 서울에 있는 경우
  if (address.includes('서울') || region.includes('서울')) {
    return 1;
  }
  
  // 수도권(경기도, 인천)에 있는 경우
  if (address.includes('경기') || address.includes('인천') || 
      region.includes('경기') || region.includes('인천')) {
    return 2;
  }
  
  // 그 외 지역
  return 3;
}

// 로컬 데이터 필터링
function filterLocalData(data, params = {}) {
  if (!data || !Array.isArray(data)) return [];
  
  let filtered = [...data];
  
  // 지역 필터
  if (params.region) {
    filtered = filtered.filter(item => 
      item.region && item.region.includes(params.region)
    );
  }
  
  // 장르 필터
  if (params.genre) {
    filtered = filtered.filter(item => 
      item.type && item.type === params.genre
    );
  }
  
  // 키워드 필터
  if (params.keyword) {
    const searchTerm = params.keyword.toLowerCase();
    filtered = filtered.filter(item => {
      const searchableText = [
        item.title || '',
        item.description || '',
        item.type || '',
        item.location || '',
        item.region || ''
      ].join(' ').toLowerCase();
      
      // 키워드 배열이 있는 경우 확인
      const keywordsMatch = item.keywords && 
        Array.isArray(item.keywords) && 
        item.keywords.some(k => k.toLowerCase().includes(searchTerm));
      
      return searchableText.includes(searchTerm) || keywordsMatch;
    });
  }
  
  // 날짜 필터
  if (params.startDate) {
    const startDate = new Date(params.startDate);
    filtered = filtered.filter(item => {
      const itemStartDate = extractStartDate(item.date);
      return itemStartDate && itemStartDate >= startDate;
    });
  }
  
  if (params.endDate) {
    const endDate = new Date(params.endDate);
    endDate.setHours(23, 59, 59); // 해당 일의 끝으로 설정
    filtered = filtered.filter(item => {
      const itemStartDate = extractStartDate(item.date);
      return itemStartDate && itemStartDate <= endDate;
    });
  }
  
  return filtered;
}

// 공연 필터링
function filterPerformances() {
  const region = document.getElementById('region').value;
  const performanceType = document.getElementById('performance-type').value;
  
  // 날짜 범위 가져오기
  const dateRange = document.getElementById('date-range').value;
  let startDate = '';
  let endDate = '';
  
  if (dateRange) {
    const dates = dateRange.split(' to ');
    startDate = dates[0];
    endDate = dates.length > 1 ? dates[1] : startDate;
  }
  
  // 페이지 초기화 (필터를 적용할 때는 첫 페이지부터 다시 시작)
  currentPage = 1;
  
  // API로 필터링된 데이터 요청
  loadFilteredPerformances(region, performanceType, startDate, endDate);
}

// 필터링된 공연 정보 로드
async function loadFilteredPerformances(region, genre, startDate = '', endDate = '') {
  const performancesContainer = document.getElementById('performances-container');
  
  // 로딩 표시
  showLoading(performancesContainer, '필터링된 공연 정보를 불러오는 중...');
  
  try {
    // API 호출
    let url = `https://5qdo7ypczighz5qhtaqzm44eb40vaahr.lambda-url.us-east-1.on.aws?page=1`;
    
    // 필터 파라미터 추가
    if (region) url += `&region=${encodeURIComponent(region)}`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    
    console.log('필터링 URL:', url);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      
      // 새로운 구조 처리
      let performances = [];
      let pagination = null;
      let stats = null;
      
      if (data.performances) {
        performances = data.performances;
        pagination = data.pagination;
        stats = data.stats;
      } else if (Array.isArray(data)) {
        performances = data;
      } else {
        throw new Error('유효하지 않은 응답 형식');
      }
      
      // 페이지네이션 정보 업데이트
      if (pagination) {
        currentPage = pagination.currentPage;
        totalPages = pagination.totalPages;
        totalCount = pagination.totalCount;
      } else {
        currentPage = 1;
        totalPages = 1;
      }
      
      // 검색 통계 업데이트
      if (stats) {
        updateSearchStats(stats);
      }
      
      // 필터링 결과 표시
      if (performances.length > 0) {
        currentPerformances = performances;
        displayPerformances(performances, true);
        updateLoadMoreButton();
        showAlert(`${performances.length}개의 공연이 필터링되었습니다.`, 'success');
      } else {
        // 필터링 결과가 없을 때
        performancesContainer.innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">
              <i class="fas fa-info-circle me-2"></i>필터 조건에 맞는 공연이 없습니다.
              <div class="mt-3">
                <button class="btn btn-outline-primary btn-sm" onclick="loadPerformances()">모든 공연 보기</button>
              </div>
            </div>
          </div>
        `;
        updateLoadMoreButton(false);
      }
    } else {
      const errorData = await response.text();
      console.error('API 응답 오류:', response.status, errorData);
      
      // API 오류 시 로컬 필터링으로 폴백
      const filteredPerformances = filterLocalData(currentPerformances, {
        region: region,
        genre: genre,
        startDate: startDate,
        endDate: endDate
      });
      
      if (filteredPerformances.length > 0) {
        displayPerformances(filteredPerformances, true);
        updateLoadMoreButton(false);
        showAlert(`로컬 데이터에서 ${filteredPerformances.length}개의 공연이 필터링되었습니다.`, 'info');
      } else {
        performancesContainer.innerHTML = `
          <div class="col-12">
            <div class="alert alert-info">
              <i class="fas fa-info-circle me-2"></i>필터 조건에 맞는 공연이 없습니다.
              <div class="mt-3">
                <button class="btn btn-outline-primary btn-sm" onclick="loadPerformances()">모든 공연 보기</button>
              </div>
            </div>
          </div>
        `;
        updateLoadMoreButton(false);
      }
    }
  } catch (error) {
    console.error('필터링된 공연 정보를 불러오는 중 오류:', error);
    
    // 오류 시 로컬 필터링으로 폴백
    const filteredPerformances = filterLocalData(currentPerformances, {
      region: region,
      genre: genre,
      startDate: startDate,
      endDate: endDate
    });
    
    displayPerformances(filteredPerformances, true);
    updateLoadMoreButton(false);
    showAlert('API 연결 오류로 로컬 데이터에서 필터링했습니다.', 'warning');
  }
}

// 대체 AI 응답 생성
function generateFallbackAIResponse(keyword, region, genre) {
  const templates = [
    `안녕하세요, "${keyword}" 키워드로 검색한 결과입니다.\n\n현재 "${keyword}"와 관련된 공연 정보를 찾을 수 없습니다. ${region ? `${region} 지역의 ` : ''}${genre ? `${genre} 장르의 ` : ''}공연 정보가 업데이트되면 알려드리겠습니다.\n\n다른 키워드로 검색해보시는 것은 어떨까요? 인기 있는 키워드로는 "클래식", "뮤지컬", "재즈", "가족", "전시" 등이 있습니다.`,
    
    `"${keyword}" 관련 공연을 찾고 계시는군요!\n\n아쉽게도 현재 "${keyword}"와 정확히 일치하는 공연은 등록되어 있지 않습니다. ${region ? `${region} 지역에서는 ` : ''}다양한 공연이 예정되어 있으니 조금 더 넓은 키워드로 검색해보세요.\n\n추천 키워드: 음악, 콘서트, 전시, 축제, 가족, 클래식`,
    
    `"${keyword}"에 관심이 있으시군요!\n\n현재 DB에 "${keyword}" 관련 공연이 없지만, 비슷한 관심사를 가진 분들이 많이 찾는 공연으로는 다음과 같은 것들이 있습니다:\n\n1. 클래식 오케스트라 정기 공연\n2. 현대미술 특별전\n3. 국악과 현대음악의 만남\n\n다른 키워드로 검색하시거나, 곧 업데이트될 새로운 공연 정보를 기대해주세요!`
  ];
  
  // 랜덤하게 템플릿 선택
  return templates[Math.floor(Math.random() * templates.length)];
}

// 공연 정보 표시
function displayPerformances(performancesList, replaceExisting = false) {
  console.log('공연 정보 표시:', performancesList.length, '개 항목');
  const performancesContainer = document.getElementById('performances-container');
  
  if (!performancesList || performancesList.length === 0) {
    performancesContainer.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>현재 표시할 공연 정보가 없습니다.
          <div class="mt-3">
            <button class="btn btn-outline-primary btn-sm" onclick="loadPerformances()">공연 정보 새로고침</button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  // 기존 데이터 대체 또는 유지
  if (replaceExisting) {
    performancesContainer.innerHTML = '';
  }
  
  // 공연 카드 HTML 생성
  let html = '';
  
  performancesList.forEach(performance => {
    // 이미지 URL 확인 (API에서 받은 이미지 또는 기본 이미지)
    const imageUrl = performance.image || '../assets/images/default-performance.png';
    
    // 소스 표시 (API 또는 샘플 데이터)
    const sourceLabel = performance.source 
      ? `<span class="badge bg-secondary source-badge">${performance.source}</span>` 
      : '';
    
    // 전화번호 정보 (있는 경우에만 표시)
    const telInfo = performance.tel && performance.tel !== '연락처 정보 없음' 
      ? `<p class="card-text"><i class="fas fa-phone me-2"></i>${performance.tel}</p>` 
      : '';
    
    // 키워드 태그 생성
    let keywordTagsHtml = '';
    if (performance.keywords && Array.isArray(performance.keywords) && performance.keywords.length > 0) {
      keywordTagsHtml = '<div class="mt-2">';
      performance.keywords.forEach(keyword => {
        keywordTagsHtml += `<span class="badge rounded-pill bg-light text-dark me-1 mb-1 keyword-tag">${keyword}</span>`;
      });
      keywordTagsHtml += '</div>';
    }
    
    // 각 공연 카드는 col-md-4 (3개씩 한 행에 표시)
    const cardHtml = `
      <div class="col-md-4 mb-4">
        <div class="card h-100 performance-card">
          <div class="card-img-top-container" style="height: 200px; overflow: hidden; position: relative;">
            <img src="${imageUrl}" class="card-img-top" alt="${performance.title}" 
                 style="width: 100%; height: 100%; object-fit: cover;">
            ${sourceLabel}
          </div>
          <div class="card-body">
            <span class="badge bg-primary mb-2">${performance.type || '기타'}</span>
            <h5 class="card-title">${performance.title}</h5>
            <p class="card-text text-truncate">${performance.description || '설명이 없습니다.'}</p>
            <p class="card-text"><i class="fas fa-map-marker-alt me-2"></i>${performance.location || '위치 정보 없음'}</p>
            <p class="card-text"><i class="fas fa-calendar me-2"></i>${performance.date || '날짜 정보 없음'}</p>
            ${telInfo}
            ${keywordTagsHtml}
          </div>
          <div class="card-footer bg-white border-top-0">
            <div class="d-flex justify-content-between">
              <button class="btn btn-outline-primary btn-sm flex-grow-1 me-1" 
                      onclick="showPerformanceDetails('${performance.id}')"
                      data-performance-id="${performance.id}">
                상세정보
              </button>
              <button class="btn btn-outline-success btn-sm" 
                      onclick="sharePerformance('${performance.id}')">
                <i class="fas fa-share-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // 기존 컨테이너에 HTML 추가 또는 html 문자열에 추가
    if (replaceExisting) {
      const cardElement = document.createElement('div');
      cardElement.innerHTML = cardHtml;
      performancesContainer.appendChild(cardElement.firstElementChild);
    } else {
      html += cardHtml;
    }
  });
  
  // 기존 데이터를 대체하지 않는 경우 한 번에 HTML 설정
  if (!replaceExisting && html) {
    performancesContainer.innerHTML = html;
  }
  
  // 키워드 태그 클릭 이벤트 추가
  document.querySelectorAll('.keyword-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const keyword = this.textContent.trim();
      
      // 키워드 입력 필드에 설정
      const keywordInput = document.getElementById('keyword-input');
      if (keywordInput) keywordInput.value = keyword;
      
      // AI 추천 요청
      getAIRecommendations('', '', keyword);
    });
  });
}

// 추가 공연 정보 표시 (기존 목록 아래에 추가)
function appendPerformances(performancesList) {
  if (!performancesList || performancesList.length === 0) return;
  
  const performancesContainer = document.getElementById('performances-container');
  
  performancesList.forEach(performance => {
    // 이미지 URL 확인
    const imageUrl = performance.image || '../assets/images/default-performance.png';
    
    // 소스 표시
    const sourceLabel = performance.source 
      ? `<span class="badge bg-secondary source-badge">${performance.source}</span>` 
      : '';
    
    // 전화번호 정보
    const telInfo = performance.tel && performance.tel !== '연락처 정보 없음' 
      ? `<p class="card-text"><i class="fas fa-phone me-2"></i>${performance.tel}</p>` 
      : '';
    
    // 키워드 태그 생성
    let keywordTagsHtml = '';
    if (performance.keywords && Array.isArray(performance.keywords) && performance.keywords.length > 0) {
      keywordTagsHtml = '<div class="mt-2">';
      performance.keywords.forEach(keyword => {
        keywordTagsHtml += `<span class="badge rounded-pill bg-light text-dark me-1 mb-1 keyword-tag">${keyword}</span>`;
      });
      keywordTagsHtml += '</div>';
    }
    
    // 새 카드 생성
    const performanceCard = document.createElement('div');
    performanceCard.className = 'col-md-4 mb-4';
    performanceCard.innerHTML = `
      <div class="card h-100 performance-card">
        <div class="card-img-top-container" style="height: 200px; overflow: hidden; position: relative;">
          <img src="${imageUrl}" class="card-img-top" alt="${performance.title}" 
               style="width: 100%; height: 100%; object-fit: cover;">
          ${sourceLabel}
        </div>
        <div class="card-body">
          <span class="badge bg-primary mb-2">${performance.type || '기타'}</span>
          <h5 class="card-title">${performance.title}</h5>
          <p class="card-text text-truncate">${performance.description || '설명이 없습니다.'}</p>
          <p class="card-text"><i class="fas fa-map-marker-alt me-2"></i>${performance.location || '위치 정보 없음'}</p>
          <p class="card-text"><i class="fas fa-calendar me-2"></i>${performance.date || '날짜 정보 없음'}</p>
          ${telInfo}
          ${keywordTagsHtml}
        </div>
        <div class="card-footer bg-white border-top-0">
          <div class="d-flex justify-content-between">
            <button class="btn btn-outline-primary btn-sm flex-grow-1 me-1" 
                    onclick="showPerformanceDetails('${performance.id}')"
                    data-performance-id="${performance.id}">
              상세정보
            </button>
            <button class="btn btn-outline-success btn-sm" 
                    onclick="sharePerformance('${performance.id}')">
              <i class="fas fa-share-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    
    // 컨테이너에 추가
    performancesContainer.appendChild(performanceCard);
    
    // 새로 추가된 카드의 키워드 태그에 이벤트 리스너 추가
    performanceCard.querySelectorAll('.keyword-tag').forEach(tag => {
      tag.addEventListener('click', function() {
        const keyword = this.textContent.trim();
        
        // 키워드 입력 필드에 설정
        const keywordInput = document.getElementById('keyword-input');
        if (keywordInput) keywordInput.value = keyword;
        
        // AI 추천 요청
        getAIRecommendations('', '', keyword);
      });
    });
  });
}

// 텍스트 형식의 추천 결과 표시
function displayTextRecommendations(text, keyword) {
  const performancesContainer = document.getElementById('performances-container');
  
  // 텍스트를 카드 형태로 표시
  performancesContainer.innerHTML = `
    <div class="col-12">
      <div class="card">
        <div class="card-header bg-primary text-white">
          <i class="fas fa-robot me-2"></i>AI 맞춤 추천: "${keyword}"
        </div>
        <div class="card-body">
          <div class="ai-response">
            ${formatAIResponse(text)}
          </div>
          <div class="mt-4">
            <button class="btn btn-outline-primary" onclick="loadPerformances()">모든 공연 보기</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// AI 응답 텍스트 포맷팅 (줄바꿈, 강조 등)
function formatAIResponse(text) {
  if (!text) return '';
  
  // 줄바꿈 처리
  let formatted = text.replace(/\n/g, '<br>');
  
  // 제목 강조 (예: [제목] 또는 **제목** 형식)
  formatted = formatted.replace(/\[([^\]]+)\]/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 링크 처리
  formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  
  return formatted;
}

// 공연 상세 정보 표시
function showPerformanceDetails(performanceId) {
  // 전체 공연 목록에서 해당 ID를 가진 공연 찾기
  const allPerformances = [...currentPerformances, ...currentRecommendations];
  const performance = allPerformances.find(p => String(p.id) === String(performanceId));
  
  if (!performance) {
    console.error('공연 정보를 찾을 수 없습니다:', performanceId);
    showAlert('공연 정보를 찾을 수 없습니다.', 'danger');
    return;
  }
  
  // 모달 내용 생성
  const modalContent = document.getElementById('performance-modal-content');
  
  // 소스 라벨 생성
  const sourceLabel = performance.source 
    ? `<span class="badge bg-secondary mt-2">출처: ${performance.source}</span>` 
    : '';
  
  // 링크 생성
  const linkButton = performance.link && performance.link !== '#' 
    ? `<a href="${performance.link}" target="_blank" class="btn btn-primary">
         <i class="fas fa-ticket-alt me-2"></i>예매하기
       </a>` 
    : '';
  
  // 지도 보기 버튼 (카카오맵)
  const mapButton = performance.location && performance.location !== '위치 정보 없음'
    ? `<a href="https://map.kakao.com/?q=${encodeURIComponent(performance.location)}" 
         target="_blank" class="btn btn-outline-success ms-2">
         <i class="fas fa-map-marked-alt me-2"></i>지도 보기
       </a>` 
    : '';
  
  // 길 찾기 버튼 (사용자 위치 정보가 있는 경우)
  const directionButton = performance.location && performance.location !== '위치 정보 없음' && userLocation
    ? `<a href="https://map.kakao.com/?to=${encodeURIComponent(performance.location)}" 
         target="_blank" class="btn btn-outline-primary ms-2">
         <i class="fas fa-directions me-2"></i>길 찾기
       </a>`
    : '';
    
  // 기본 이미지 설정
  const imageUrl = performance.image || '../assets/images/default-performance.png';
  
  // 키워드 태그 생성
  let keywordTagsHtml = '';
  if (performance.keywords && Array.isArray(performance.keywords) && performance.keywords.length > 0) {
    keywordTagsHtml = '<div class="mt-3"><h6>키워드:</h6>';
    performance.keywords.forEach(keyword => {
      keywordTagsHtml += `<span class="badge rounded-pill bg-light text-dark me-2 mb-2 py-2 px-3 tag-badge">${keyword}</span>`;
    });
    keywordTagsHtml += '</div>';
  }
  
  modalContent.innerHTML = `
    <div class="row">
      <div class="col-md-5">
        <img src="${imageUrl}" class="img-fluid rounded" alt="${performance.title}">
        ${sourceLabel}
      </div>
      <div class="col-md-7">
        <h3>${performance.title}</h3>
        <p class="badge bg-primary">${performance.type || '기타'}</p>
        <p class="description">${performance.description || '설명이 없습니다.'}</p>
        
        <div class="details mt-4">
          <p><i class="fas fa-map-marker-alt me-2"></i> <strong>장소:</strong> ${performance.location || '위치 정보 없음'}</p>
          <p><i class="fas fa-calendar me-2"></i> <strong>날짜:</strong> ${performance.date || '날짜 정보 없음'}</p>
          <p><i class="fas fa-phone me-2"></i> <strong>전화번호:</strong> ${performance.tel || '전화번호 정보 없음'}</p>
          <p><i class="fas fa-map me-2"></i> <strong>지역:</strong> ${performance.region || '지역 정보 없음'}</p>
          <p><i class="fas fa-tag me-2"></i> <strong>가격:</strong> ${performance.price || '가격 정보 없음'}</p>
        </div>
        
        ${keywordTagsHtml}
        
        <div class="action-buttons mt-4">
          ${linkButton}
          ${mapButton}
          ${directionButton}
          <button class="btn btn-outline-info ms-2" onclick="sharePerformance('${performanceId}')">
            <i class="fas fa-share-alt me-2"></i>공유하기
          </button>
        </div>
      </div>
    </div>
  `;
  
  // 모달 표시
  const performanceModal = new bootstrap.Modal(document.getElementById('performanceModal'));
  performanceModal.show();
}

// 로딩 표시 함수
function showLoading(container, message = '로딩 중...') {
  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3">${message}</p>
    </div>
  `;
}

// 알림 메시지 표시
function showAlert(message, type = 'info', duration = 5000) {
  // 알림 컨테이너 생성 또는 가져오기
  let alertContainer = document.getElementById('alert-container');
  
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.style.position = 'fixed';
    alertContainer.style.top = '20px';
    alertContainer.style.right = '20px';
    alertContainer.style.zIndex = '1050';
    document.body.appendChild(alertContainer);
  }
  
  // 알림 요소 생성
  const alertId = 'alert-' + new Date().getTime();
  const alertElement = document.createElement('div');
  alertElement.id = alertId;
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.role = 'alert';
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // 컨테이너에 알림 추가
  alertContainer.appendChild(alertElement);
  
  // 지정 시간 후 자동으로 사라짐
  setTimeout(() => {
    const alert = document.getElementById(alertId);
    if (alert) {
      alert.classList.remove('show');
      setTimeout(() => alert.remove(), 300);
    }
  }, duration);
}

// 공연 정보 공유
function sharePerformance(performanceId) {
  // 현재 페이지 URL + 공연 ID 파라미터
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${performanceId}`;
  
  // 공유하기 API 지원 확인
  if (navigator.share) {
    // 공연 정보 찾기
    const allPerformances = [...currentPerformances, ...currentRecommendations];
    const performance = allPerformances.find(p => String(p.id) === String(performanceId));
    
    if (performance) {
      navigator.share({
        title: `${performance.title} - 나라투어 공연 정보`,
        text: `${performance.title}\n${performance.location || ''}, ${performance.date || ''}\n${performance.description || ''}`,
        url: shareUrl
      })
      .then(() => console.log('공유 성공'))
      .catch((error) => {
        console.log('공유 에러', error);
        // 공유 API 실패 시 클립보드 복사로 대체
        copyToClipboard(shareUrl);
      });
    } else {
      // 클립보드 복사로 대체
      copyToClipboard(shareUrl);
    }
  } else {
    // 공유 API를 지원하지 않는 경우 공유 옵션 표시
    showShareOptions(performanceId, shareUrl);
  }
}

// 공유 옵션 표시
function showShareOptions(performanceId, shareUrl) {
  // 공연 정보 찾기
  const allPerformances = [...currentPerformances, ...currentRecommendations];
  const performance = allPerformances.find(p => String(p.id) === String(performanceId));
  
  if (!performance) {
    copyToClipboard(shareUrl);
    return;
  }
  
  // 공유 옵션 모달 생성
  const modalHtml = `
    <div class="modal fade" id="shareModal" tabindex="-1" aria-labelledby="shareModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="shareModalLabel">공연 정보 공유</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>다음 공연 정보를 공유합니다:</p>
            <div class="card mb-3">
              <div class="card-body">
                <h5 class="card-title">${performance.title}</h5>
                <p class="card-text">${performance.location || '위치 정보 없음'}, ${performance.date || '날짜 정보 없음'}</p>
              </div>
            </div>
            
            <div class="d-flex justify-content-around mt-4">
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`${performance.title} - 나라투어 공연 정보`)}&url=${encodeURIComponent(shareUrl)}" 
                 target="_blank" class="btn btn-outline-primary">
                <i class="fab fa-twitter me-2"></i>트위터
              </a>
              
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" 
                 target="_blank" class="btn btn-outline-primary">
                <i class="fab fa-facebook me-2"></i>페이스북
              </a>
              
              <button class="btn btn-outline-primary" onclick="copyToClipboard('${shareUrl}')">
                <i class="far fa-copy me-2"></i>링크 복사
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 기존 모달 제거
  const existingModal = document.getElementById('shareModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // 모달 추가
  const modalElement = document.createElement('div');
  modalElement.innerHTML = modalHtml;
  document.body.appendChild(modalElement.firstElementChild);
  
  // 모달 표시
  const shareModal = new bootstrap.Modal(document.getElementById('shareModal'));
  shareModal.show();
}

// 클립보드에 복사
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => {
        showAlert('링크가 클립보드에 복사되었습니다.', 'success');
      })
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
        showAlert('클립보드 복사에 실패했습니다.', 'danger');
      });
  } else {
    // 구형 브라우저 지원
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      showAlert('링크가 클립보드에 복사되었습니다.', 'success');
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      showAlert('클립보드 복사에 실패했습니다.', 'danger');
    }
    
    document.body.removeChild(textArea);
  }
}

// 최신 공연 소식 로드
function loadLatestNews() {
  console.log('최신 공연 소식 로드 시작');
  const newsContainer = document.getElementById('performance-news');
  
  if (!newsContainer) return;
  
  try {
    // 샘플 뉴스 데이터 사용
    const newsItems = [
      {
        title: '여름 음악 축제 일정 발표',
        date: '2025-05-15',
        summary: '2025년 여름 음악 축제 일정이 발표되었습니다. 올해는 총 15개 도시에서 다양한 장르의 음악 축제가 개최됩니다.',
        source: '문화체육관광부'
      },
      {
        title: '해외 유명 뮤지컬 내한 공연 예정',
        date: '2025-05-10',
        summary: '브로드웨이의 인기 뮤지컬이 오는 7월 한국 관객을 찾아옵니다. 티켓 예매는 6월부터 시작될 예정입니다.',
        source: '공연예술통합전산망'
      },
      {
        title: '국립극장 시설 리모델링 완료',
        date: '2025-05-05',
        summary: '6개월간의 리모델링 공사를 마친 국립극장이 6월부터 다시 문을 엽니다. 새로운 음향 시스템과 좌석이 설치되었습니다.',
        source: '국립극장'
      }
    ];
    
    // 뉴스 HTML 생성
    let newsHtml = '<div class="row">';
    
    newsItems.forEach(item => {
      const newsDate = new Date(item.date);
      const formattedDate = newsDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // 소스 표시
      const sourceLabel = item.source ? `<small class="text-muted">출처: ${item.source}</small>` : '';
      
      newsHtml += `
        <div class="col-md-4 mb-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">${item.title}</h5>
              <p class="card-text text-muted"><small>${formattedDate}</small></p>
              <p class="card-text">${item.summary}</p>
              ${sourceLabel}
            </div>
          </div>
        </div>
      `;
    });
    
    newsHtml += '</div>';
    newsContainer.innerHTML = newsHtml;
    
  } catch (error) {
    console.error('뉴스를 불러오는 중 오류가 발생했습니다:', error);
    newsContainer.innerHTML = `
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle me-2"></i>최신 소식을 불러오는 데 실패했습니다.
        <button class="btn btn-sm btn-outline-warning ms-3" onclick="loadLatestNews()">다시 시도</button>
      </div>
    `;
  }
}

// URL 파라미터 처리 (페이지 로드 시 특정 공연 표시)
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const performanceId = urlParams.get('id');
  
  if (performanceId) {
    // 공연 데이터 로드 후 상세 정보 표시
    loadPerformances().then(() => {
      // 약간의 지연 후 상세 정보 표시 (데이터 로드 대기)
      setTimeout(() => {
        showPerformanceDetails(performanceId);
      }, 1000);
    });
  }
});

// 샘플 공연 데이터 생성 (API 호출 실패 시 대체용)
function generateSamplePerformances() {
  // 샘플 데이터 배열
  const samplePerformances = [
    {
      id: 'sample-1',
      title: "가평군 반려동물 문화행사 활짝펫",
      description: "반려동물과 함께하는 다양한 체험 행사와 공연이 준비되어 있습니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/40/3490940_image2_1.jpg",
      location: "경기도 가평군 가평읍 자라섬로 60",
      date: "2025-06-07 ~ 2025-06-07",
      price: "무료(추정)",
      region: "경기도",
      tel: "070-8233-0333",
      source: "샘플 데이터",
      link: "#",
      keywords: ["반려동물", "체험", "가족"]
    },
    {
      id: 'sample-2',
      title: "강릉단오제",
      description: "우리나라를 대표하는 전통 문화축제로, 강릉의 역사와 문화를 체험할 수 있는 다양한 행사가 열립니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/54/3484354_image2_1.jpg",
      location: "강원특별자치도 강릉시 단오장길 1",
      date: "2025-05-27 ~ 2025-06-03",
      price: "무료(추정)",
      region: "강원도",
      tel: "033-641-1593",
      source: "샘플 데이터",
      link: "#",
      keywords: ["전통", "문화", "단오"]
    },
    {
      id: 'sample-3',
      title: "강릉커피축제",
      description: "국내 최고의 커피 명소 강릉에서 열리는 커피 축제로, 다양한 커피를 맛볼 수 있고 바리스타 경연대회 등이 열립니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/26/3370626_image2_1.jpg",
      location: "강원특별자치도 강릉시 창해로14번길 20-1 (견소동)",
      date: "2025-10-23 ~ 2025-10-26",
      price: "무료(추정)",
      region: "강원도",
      tel: "033-647-6802",
      source: "샘플 데이터",
      link: "#",
      keywords: ["커피", "음식", "체험"]
    },
    {
      id: 'sample-4',
      title: "강서 아이들 까치까치 페스티벌",
      description: "어린이들을 위한 다양한 체험과, 공연이 펼쳐지는 축제입니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/73/3489673_image2_1.JPG",
      location: "서울특별시 강서구 우장산로 66 (내발산동)",
      date: "2025-05-24 ~ 2025-05-24",
      price: "무료(추정)",
      region: "서울",
      tel: "02-2600-6970",
      source: "샘플 데이터",
      link: "#",
      keywords: ["아동", "체험", "가족"]
    },
    {
      id: 'sample-5',
      title: "강서구 다문화축제",
      description: "다양한 문화를 체험하고 즐길 수 있는 다문화 축제입니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/01/3489701_image2_1.jpg",
      location: "서울특별시 강서구 강서로5길 50 (화곡동)",
      date: "2025-05-24 ~ 2025-05-24",
      price: "무료(추정)",
      region: "서울",
      tel: "02-2600-6763",
      source: "샘플 데이터",
      link: "#",
      keywords: ["다문화", "체험", "문화"]
    },
    {
      id: 'sample-6',
      title: "경기미 김밥페스타",
      description: "경기미를 활용한 다양한 김밥을 맛볼 수 있는 음식 축제입니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/23/3486723_image2_1.jpg",
      location: "경기도 수원시 영통구 광교중앙로 140 (하동) 수원컨벤션센터 제2전시장",
      date: "2025-06-21 ~ 2025-06-21",
      price: "무료(추정)",
      region: "경기도",
      tel: "031-774-3312",
      source: "샘플 데이터",
      link: "#",
      keywords: ["김밥", "음식", "체험"]
    },
    {
      id: 'sample-7',
      title: "경남고성공룡세계엑스포",
      description: "공룡 화석지로 유명한 고성에서 개최되는 공룡 테마 엑스포입니다.",
      type: "전시",
      image: "http://tong.visitkorea.or.kr/cms/resource/62/2987562_image2_1.png",
      location: "경상남도 고성군 당항만로 1116 당항포관광지",
      date: "2025-10-01 ~ 2025-11-09",
      price: "유료(추정)",
      region: "경상남도",
      tel: "055-670-7400",
      source: "샘플 데이터",
      link: "#",
      keywords: ["공룡", "체험", "가족"]
    },
    {
      id: 'sample-8',
      title: "경복궁 생과방",
      description: "경복궁에서 진행되는 전통 간식을 체험할 수 있는 문화 행사입니다.",
      type: "체험",
      image: "http://tong.visitkorea.or.kr/cms/resource/99/2962999_image2_1.jpg",
      location: "서울특별시 종로구 사직로 161 (세종로)",
      date: "2025-05-20 ~ 2025-06-23",
      price: "유료(추정)",
      region: "서울",
      tel: "1522-2295",
      source: "샘플 데이터",
      link: "#",
      keywords: ["전통", "음식", "체험"]
    },
    {
      id: 'sample-9',
      title: "경산자인단오제",
      description: "전통 단오제를 현대적으로 재해석한 지역 축제입니다.",
      type: "축제",
      image: "http://tong.visitkorea.or.kr/cms/resource/99/2718299_image2_1.jpg",
      location: "경상북도 경산시 자인면 계정길 68 계정숲",
      date: "2025-05-30 ~ 2025-06-01",
      price: "무료(추정)",
      region: "경상북도",
      tel: "053-856-5765",
      source: "샘플 데이터",
      link: "#",
      keywords: ["단오", "전통", "체험"]
    }
  ];

  return samplePerformances;
}