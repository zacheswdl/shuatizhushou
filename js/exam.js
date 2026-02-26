/**
 * Mock Exam Module
 * Random quiz with timer and scoring
 */
var Exam = (function() {
  var _questions = [];
  var _currentIdx = 0;
  var _answers = {};  // { qId: answer }
  var _timer = null;
  var _timeLeft = 0;
  var _totalTime = 0;
  var _config = { count: 10, minutes: 15 };

  function renderSetup() {
    var container = document.getElementById('pageExam');
    var total = App.getAllQuestions().length;
    var maxQ = Math.min(total, 50);

    var history = Storage.getExamHistory();

    var html = '<div class="exam-setup">' +
      '<div class="exam-config-card">' +
        '<div style="font-size:16px;font-weight:600;color:var(--gray-800);margin-bottom:16px">考试设置</div>' +
        '<div class="config-row">' +
          '<div class="config-label">题目数量</div>' +
          '<div class="config-value">' +
            '<button class="num-btn" onclick="Exam.adjustCount(-5)">-</button>' +
            '<span class="num-display" id="examCount">' + _config.count + '</span>' +
            '<button class="num-btn" onclick="Exam.adjustCount(5)">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="config-row">' +
          '<div class="config-label">考试时长（分钟）</div>' +
          '<div class="config-value">' +
            '<button class="num-btn" onclick="Exam.adjustTime(-5)">-</button>' +
            '<span class="num-display" id="examTime">' + _config.minutes + '</span>' +
            '<button class="num-btn" onclick="Exam.adjustTime(5)">+</button>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--gray-400);margin-top:12px">从全部 ' + total + ' 道题中随机抽取（含选择题和简答题）</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block" onclick="Exam.begin()" style="height:48px;font-size:16px">开始考试</button>';

    // History
    if (history.length > 0) {
      html += '<div style="margin-top:24px">' +
        '<div style="font-size:15px;font-weight:600;color:var(--gray-700);margin-bottom:12px">历史记录</div>' +
        '<div class="card" style="padding:4px 16px">';
      history.forEach(function(h) {
        html += '<div class="history-item">' +
          '<div class="history-info">' +
            '<div class="history-date">' + h.date + '</div>' +
            '<div class="history-detail">' + h.total + '题 · 用时' + h.usedTime + '</div>' +
          '</div>' +
          '<div class="history-score">' + h.score + '<span style="font-size:13px;color:var(--gray-400)">分</span></div>' +
        '</div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function adjustCount(delta) {
    var total = App.getAllQuestions().length;
    _config.count = Math.max(5, Math.min(total, _config.count + delta));
    var el = document.getElementById('examCount');
    if (el) el.textContent = _config.count;
  }

  function adjustTime(delta) {
    _config.minutes = Math.max(5, Math.min(120, _config.minutes + delta));
    var el = document.getElementById('examTime');
    if (el) el.textContent = _config.minutes;
  }

  function begin() {
    var allQ = App.getAllQuestions();
    var shuffled = App.shuffle(allQ);
    _questions = shuffled.slice(0, _config.count);
    _currentIdx = 0;
    _answers = {};
    _totalTime = _config.minutes * 60;
    _timeLeft = _totalTime;

    App.navigate('examQuiz');
  }

  function startExam() {
    _startTimer();
    _renderExamQuestion();
  }

  function _startTimer() {
    clearInterval(_timer);
    _timer = setInterval(function() {
      _timeLeft--;
      _updateTimerDisplay();
      if (_timeLeft <= 0) {
        clearInterval(_timer);
        _autoSubmit();
      }
    }, 1000);
  }

  function _updateTimerDisplay() {
    var el = document.getElementById('examTimer');
    if (!el) return;
    var m = Math.floor(_timeLeft / 60);
    var s = _timeLeft % 60;
    el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    el.parentElement.classList.toggle('warning', _timeLeft < 60);
  }

  function _renderExamQuestion() {
    var container = document.getElementById('pageExamQuiz');
    var q = _questions[_currentIdx];

    // Timer in header
    var m = Math.floor(_timeLeft / 60);
    var s = _timeLeft % 60;
    document.getElementById('headerRight').innerHTML =
      '<div class="exam-timer">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<span id="examTimer">' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '</span>' +
      '</div>';

    document.getElementById('headerTitle').textContent = '第 ' + (_currentIdx + 1) + '/' + _questions.length + ' 题';

    var userAns = _answers[q.id];
    var hasAnswered = userAns !== undefined;

    var html = '<div class="question-card">';
    html += '<div class="q-header">' +
      '<span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span>' +
    '</div>';
    html += '<div class="q-stem">' + App.escHtml(q.question).replace(/\n/g, '<br>') + '</div>';

    if (q.type === 'essay') {
      html += '<textarea class="essay-answer-area" id="essayExamInput" placeholder="请输入您的答案..." oninput="Exam.saveEssay(\'' + q.id + '\')">' +
        (userAns || '') + '</textarea>';
    } else {
      q.options.forEach(function(opt, i) {
        var letter = String.fromCharCode(65 + i);
        var cls = 'option-item';
        if (q.type === 'multiple') cls += ' multi';

        if (q.type === 'multiple') {
          if (Array.isArray(userAns) && userAns.indexOf(letter) !== -1) cls += ' selected';
        } else {
          if (userAns === letter) cls += ' selected';
        }

        html += '<div class="' + cls + '" onclick="Exam.pickOption(\'' + q.id + '\',\'' + letter + '\')">' +
          '<div class="option-label">' + letter + '</div>' +
          '<div class="option-text">' + App.escHtml(opt.replace(/^[A-E]\.\s*/, '')) + '</div>' +
        '</div>';
      });
    }

    // Nav
    html += '<div class="q-nav">';
    html += _currentIdx > 0 ?
      '<button class="btn btn-outline" onclick="Exam.prevQ()">上一题</button>' : '<div></div>';
    if (_currentIdx < _questions.length - 1) {
      html += '<button class="btn btn-primary" onclick="Exam.nextQ()">下一题</button>';
    } else {
      html += '<button class="btn btn-success" onclick="Exam.submitExam()">交卷</button>';
    }
    html += '</div>';

    // Answer sheet
    html += '<div style="margin-top:8px">' +
      '<div style="font-size:14px;font-weight:600;color:var(--gray-600);margin-bottom:8px">答题卡 <span style="font-weight:400;color:var(--gray-400)">(已答 ' + _getAnsweredCount() + '/' + _questions.length + ')</span></div>' +
      '<div class="answer-sheet">';
    _questions.forEach(function(qq, idx) {
      var cls = 'sheet-item';
      if (idx === _currentIdx) cls += ' current';
      else if (_answers[qq.id] !== undefined) cls += ' answered';
      html += '<div class="' + cls + '" onclick="Exam.jumpQ(' + idx + ')">' + (idx + 1) + '</div>';
    });
    html += '</div></div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function _getAnsweredCount() {
    var c = 0;
    _questions.forEach(function(q) {
      var a = _answers[q.id];
      if (a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0)) c++;
    });
    return c;
  }

  function pickOption(qId, letter) {
    var q = App.getQuestionById(qId);
    if (!q) return;

    if (q.type === 'multiple') {
      var sel = _answers[qId] || [];
      if (!Array.isArray(sel)) sel = [];
      var idx = sel.indexOf(letter);
      if (idx === -1) sel.push(letter);
      else sel.splice(idx, 1);
      sel.sort();
      _answers[qId] = sel;
    } else {
      _answers[qId] = letter;
    }
    _renderExamQuestion();
  }

  function saveEssay(qId) {
    var el = document.getElementById('essayExamInput');
    if (el) _answers[qId] = el.value;
  }

  function prevQ() {
    if (_currentIdx > 0) { _currentIdx--; _renderExamQuestion(); document.getElementById('mainContent').scrollTop = 0; }
  }

  function nextQ() {
    if (_currentIdx < _questions.length - 1) { _currentIdx++; _renderExamQuestion(); document.getElementById('mainContent').scrollTop = 0; }
  }

  function jumpQ(idx) {
    _currentIdx = idx;
    _renderExamQuestion();
    document.getElementById('mainContent').scrollTop = 0;
  }

  async function submitExam() {
    var unanswered = _questions.length - _getAnsweredCount();
    if (unanswered > 0) {
      App.showModal('确认交卷', '还有 ' + unanswered + ' 题未作答，确定要交卷吗？', [
        { text: '继续答题', cls: 'btn-outline' },
        { text: '确定交卷', cls: 'btn-primary', fn: async function() { await _finishExam(); } }
      ]);
    } else {
      await _finishExam();
    }
  }

  async function _autoSubmit() {
    App.toast('时间到，自动交卷');
    await _finishExam();
  }

  async function _finishExam() {
    clearInterval(_timer);

    // Score calculation
    var correctCount = 0;
    var wrongCount = 0;
    var objectiveTotal = 0;
    var results = [];

    for (var i = 0; i < _questions.length; i++) {
      var q = _questions[i];
      var userAns = _answers[q.id];
      var isCorrect = false;

      if (q.type === 'essay') {
        // Essay: auto-mark as reviewed (no auto-scoring)
        results.push({ q: q, userAns: userAns || '(未作答)', isCorrect: null });
        continue;
      }

      objectiveTotal++;
      if (q.type === 'multiple') {
        isCorrect = Array.isArray(userAns) && userAns.join('') === q.answer;
      } else {
        isCorrect = userAns === q.answer;
      }

      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        await Storage.addWrong(q.id);
      }
      results.push({ q: q, userAns: userAns, isCorrect: isCorrect });
    }

    var score = objectiveTotal > 0 ? Math.round(correctCount / objectiveTotal * 100) : 0;
    var usedSeconds = _totalTime - _timeLeft;
    var usedM = Math.floor(usedSeconds / 60);
    var usedS = usedSeconds % 60;
    var usedTime = usedM + '分' + usedS + '秒';

    // Save history
    var now = new Date();
    await Storage.addExamHistory({
      date: now.getFullYear() + '-' + (now.getMonth()+1 < 10 ? '0' : '') + (now.getMonth()+1) + '-' + (now.getDate() < 10 ? '0' : '') + now.getDate() + ' ' + (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes(),
      score: score,
      total: _questions.length,
      correct: correctCount,
      wrong: wrongCount,
      usedTime: usedTime
    });

    _renderResult(score, correctCount, wrongCount, usedTime, results);
  }

  function _renderResult(score, correctCount, wrongCount, usedTime, results) {
    var container = document.getElementById('pageExamResult');
    document.getElementById('headerTitle').textContent = '考试结果';
    document.getElementById('headerRight').innerHTML = '';

    var html = '<div class="result-card card">' +
      '<div class="result-score">' + score + '</div>' +
      '<div class="result-label">得分 (客观题)</div>' +
      '<div class="result-stats">' +
        '<div class="result-stat correct"><div class="num">' + correctCount + '</div><div class="label">答对</div></div>' +
        '<div class="result-stat wrong"><div class="num">' + wrongCount + '</div><div class="label">答错</div></div>' +
        '<div class="result-stat"><div class="num" style="color:var(--gray-600)">' + usedTime + '</div><div class="label">用时</div></div>' +
      '</div>' +
    '</div>';

    html += '<div style="font-size:15px;font-weight:600;color:var(--gray-700);margin:20px 0 12px">答题详情</div>';

    results.forEach(function(r, idx) {
      var q = r.q;
      html += '<div class="card">';
      html += '<div class="q-header">' +
        '<span class="q-index">' + (idx + 1) + '.</span>' +
        '<span class="tag ' + App.getTypeTag(q.type) + '">' + App.getTypeLabel(q.type) + '</span>';
      if (r.isCorrect === true) html += '<span class="tag tag-green">正确</span>';
      else if (r.isCorrect === false) html += '<span class="tag tag-red">错误</span>';
      else html += '<span class="tag tag-yellow">主观题</span>';
      html += '</div>';

      html += '<div class="q-stem" style="font-size:14px">' + App.escHtml(q.question).replace(/\n/g, '<br>') + '</div>';

      if (q.type !== 'essay') {
        q.options.forEach(function(opt, i) {
          var letter = String.fromCharCode(65 + i);
          var cls = 'option-item disabled';
          var isCorrectOpt = q.answer.indexOf(letter) !== -1;
          var isSelectedOpt = q.type === 'multiple' ?
            (Array.isArray(r.userAns) && r.userAns.indexOf(letter) !== -1) :
            r.userAns === letter;

          if (isCorrectOpt) cls += ' correct';
          else if (isSelectedOpt) cls += ' wrong';

          html += '<div class="' + cls + '" style="padding:10px 12px;margin-bottom:6px">' +
            '<div class="option-label" style="width:22px;height:22px;font-size:12px">' + letter + '</div>' +
            '<div class="option-text" style="font-size:13px">' + App.escHtml(opt.replace(/^[A-E]\.\s*/, '')) + '</div>' +
          '</div>';
        });
        html += '<div style="font-size:13px;color:var(--gray-500);margin-top:4px">正确答案：<strong style="color:var(--success)">' + q.answer + '</strong></div>';
      } else {
        html += '<div class="answer-box"><div class="ans-title">参考答案</div>' +
          '<div class="ans-content" style="font-size:13px">' + App.escHtml(q.answer).replace(/\n/g, '<br>') + '</div></div>';
      }

      if (q.explanation) {
        html += '<div class="explanation-box" style="margin-top:10px">' +
          '<div class="exp-title" style="font-size:12px">解析</div>' +
          '<div class="exp-content" style="font-size:13px">' + App.escHtml(q.explanation) + '</div>' +
        '</div>';
      }
      html += '</div>';
    });

    html += '<div style="padding:16px 0"><button class="btn btn-primary btn-block" onclick="App.switchTab(\'home\')">返回首页</button></div>';

    container.innerHTML = html;

    // Navigate to result page
    document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
    container.classList.add('active');
    document.getElementById('mainContent').scrollTop = 0;
  }

  return {
    renderSetup: renderSetup,
    adjustCount: adjustCount,
    adjustTime: adjustTime,
    begin: begin,
    startExam: startExam,
    pickOption: pickOption,
    saveEssay: saveEssay,
    prevQ: prevQ,
    nextQ: nextQ,
    jumpQ: jumpQ,
    submitExam: submitExam
  };
})();