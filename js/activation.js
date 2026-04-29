/**
 * Auth Module
 * Uses Supabase Auth for email/password sign up and sign in.
 */
var Auth = (function() {
  var _currentUser = null;
  var _currentProfile = null;
  var _authListenerBound = false;
  var _pendingRecoveryEmail = '';
  var _pendingSignupEmail = '';

  function _escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  async function getCurrentUser() {
    try {
      var result = await supabase.auth.getUser();
      _currentUser = result && result.data ? result.data.user : null;
      return _currentUser;
    } catch (e) {
      console.warn('Get current user failed:', e);
      _currentUser = null;
      return null;
    }
  }

  function getCurrentUserId() {
    return _currentUser ? _currentUser.id : null;
  }

  async function ensureProfile() {
    var user = _currentUser || await getCurrentUser();
    if (!user) return null;

    try {
      var existing = await getCurrentProfile(true);
      if (existing) return existing;

      var insertResult = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email || ''
        })
        .select('*')
        .single();
      if (insertResult.error) throw insertResult.error;
      _currentProfile = insertResult.data || null;
      return _currentProfile;
    } catch (e) {
      console.warn('Ensure profile failed:', e);
      return getCurrentProfile(true);
    }
  }

  async function getCurrentProfile(forceRefresh) {
    var user = _currentUser || await getCurrentUser();
    if (!user) {
      _currentProfile = null;
      return null;
    }
    if (_currentProfile && !forceRefresh) return _currentProfile;

    try {
      var result = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (result.error) throw result.error;
      _currentProfile = result.data || null;
      return _currentProfile;
    } catch (e) {
      console.warn('Get current profile failed:', e);
      _currentProfile = null;
      return null;
    }
  }

  async function isAdmin(forceRefresh) {
    var profile = await getCurrentProfile(forceRefresh);
    return !!(profile && profile.role === 'admin');
  }

  async function isBanned(forceRefresh) {
    var profile = await getCurrentProfile(forceRefresh);
    return !!(profile && profile.is_banned);
  }

  function getCurrentUserEmail() {
    return _currentUser && _currentUser.email ? _currentUser.email : '';
  }

  async function _assertAccountAvailable() {
    await ensureProfile();
    if (await isBanned(true)) {
      await _signOutSilently();
      throw new Error('该账号已被管理员封禁，无法登录');
    }
  }

  async function _signOutSilently() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Silent sign out failed:', e);
    } finally {
      _currentUser = null;
      _currentProfile = null;
    }
  }

  async function signIn(email, password) {
    var { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (error) throw error;
    await getCurrentUser();
    await _assertAccountAvailable();
    return _currentUser;
  }

  async function signUp(email, password) {
    var { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
    });
    if (error) throw error;
    if (data && data.user && !data.session) {
      return { needConfirm: true };
    }
    await getCurrentUser();
    await _assertAccountAvailable();
    return { needConfirm: false };
  }

  async function resendSignupCode(email) {
    var result = await supabase.auth.resend({
      type: 'signup',
      email: email
    });
    if (result.error) throw result.error;
    return true;
  }

  async function verifySignupCode(email, token) {
    var result = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'signup'
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function sendPasswordReset(email) {
    var result = await supabase.auth.resetPasswordForEmail(email);
    if (result.error) throw result.error;
    return true;
  }

  async function verifyRecoveryCode(email, token) {
    var result = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'recovery'
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function updatePassword(newPassword) {
    var result = await supabase.auth.updateUser({
      password: newPassword
    });
    if (result.error) throw result.error;
    return true;
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      _currentUser = null;
      _currentProfile = null;
      window.location.reload();
    }
  }

  function renderModal() {
    var overlay = document.getElementById('activationOverlay');
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="activation-card">' +
        '<div class="activation-icon">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="1.5">' +
            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
            '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="activation-title">账号登录</h2>' +
        '<p class="activation-desc">请先登录或注册后再使用刷题助手</p>' +
        '<input type="email" id="authEmailInput" class="activation-input" placeholder="请输入邮箱">' +
        '<input type="password" id="authPasswordInput" class="activation-input" style="margin-top:10px" placeholder="请输入密码（至少6位）">' +
        '<div class="activation-error hidden" id="authError"></div>' +
        '<button class="btn btn-primary btn-block activation-btn" id="authLoginBtn" onclick="Auth.handleLogin()">登录</button>' +
        '<button class="btn btn-outline btn-block activation-btn" id="authRegisterBtn" style="margin-top:10px" onclick="Auth.handleRegister()">注册</button>' +
        '<button class="btn btn-text btn-block activation-btn" id="authForgotBtn" style="margin-top:10px" onclick="Auth.handleForgotPassword()">忘记密码</button>' +
      '</div>';

    setTimeout(function() {
      var input = document.getElementById('authEmailInput');
      if (input) input.focus();
    }, 200);
  }

  function renderRecoveryModal(email) {
    _pendingRecoveryEmail = email || _pendingRecoveryEmail || '';
    var overlay = document.getElementById('activationOverlay');
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="activation-card">' +
        '<div class="activation-icon">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="1.5">' +
            '<path d="M12 17v.01"/>' +
            '<path d="M8 10V7a4 4 0 1 1 8 0v3"/>' +
            '<rect x="4" y="10" width="16" height="10" rx="2"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="activation-title">验证码重置</h2>' +
        '<p class="activation-desc">验证码已发送到邮箱<br>' + _escHtml(_pendingRecoveryEmail) + '</p>' +
        '<input type="text" id="resetCodeInput" class="activation-input" inputmode="numeric" maxlength="8" placeholder="请输入邮件中的验证码">' +
        '<input type="password" id="resetPasswordInput" class="activation-input" style="margin-top:10px" placeholder="请输入新密码（至少6位）">' +
        '<input type="password" id="resetPasswordConfirmInput" class="activation-input" style="margin-top:10px" placeholder="请再次输入新密码">' +
        '<div class="activation-error hidden" id="resetPasswordError"></div>' +
        '<button class="btn btn-primary btn-block activation-btn" id="resetPasswordBtn" onclick="Auth.handleResetPassword()">验证并重置密码</button>' +
        '<button class="btn btn-outline btn-block activation-btn" id="resetResendBtn" style="margin-top:10px" onclick="Auth.handleResendRecoveryCode()">重新发送验证码</button>' +
        '<button class="btn btn-text btn-block activation-btn" id="resetBackBtn" style="margin-top:10px" onclick="Auth.renderModal()">返回登录</button>' +
      '</div>';

    setTimeout(function() {
      var input = document.getElementById('resetCodeInput');
      if (input) input.focus();
    }, 200);
  }

  function renderSignupVerifyModal(email) {
    _pendingSignupEmail = email || _pendingSignupEmail || '';
    var overlay = document.getElementById('activationOverlay');
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="activation-card">' +
        '<div class="activation-icon">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="1.5">' +
            '<path d="M4 4h16v16H4z"/>' +
            '<path d="m4 7 8 6 8-6"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="activation-title">验证邮箱</h2>' +
        '<p class="activation-desc">验证码已发送到注册邮箱<br>' + _escHtml(_pendingSignupEmail) + '</p>' +
        '<input type="text" id="signupCodeInput" class="activation-input" inputmode="numeric" maxlength="8" placeholder="请输入邮件中的验证码">' +
        '<div class="activation-error hidden" id="signupVerifyError"></div>' +
        '<button class="btn btn-primary btn-block activation-btn" id="signupVerifyBtn" onclick="Auth.handleVerifySignup()">验证并完成注册</button>' +
        '<button class="btn btn-outline btn-block activation-btn" id="signupResendBtn" style="margin-top:10px" onclick="Auth.handleResendSignupCode()">重新发送验证码</button>' +
        '<button class="btn btn-text btn-block activation-btn" id="signupBackBtn" style="margin-top:10px" onclick="Auth.renderModal()">返回登录</button>' +
      '</div>';

    setTimeout(function() {
      var input = document.getElementById('signupCodeInput');
      if (input) input.focus();
    }, 200);
  }

  function _showAuthMessage(msg, isError) {
    var errEl = document.getElementById('authError');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.toggle('hidden', !msg);
    errEl.style.color = isError ? '' : '#10B981';
  }

  function _bindAuthListener() {
    if (_authListenerBound) return;
    _authListenerBound = true;

    supabase.auth.onAuthStateChange(function(event, session) {
      _currentUser = session ? session.user : null;
      if (!session) _currentProfile = null;
      if (event === 'PASSWORD_RECOVERY') {
        renderRecoveryModal();
      }
    });
  }

  async function _handleSubmit(mode) {
    var emailInput = document.getElementById('authEmailInput');
    var passwordInput = document.getElementById('authPasswordInput');
    var loginBtn = document.getElementById('authLoginBtn');
    var registerBtn = document.getElementById('authRegisterBtn');
    var forgotBtn = document.getElementById('authForgotBtn');
    var errEl = document.getElementById('authError');
    var email = (emailInput.value || '').trim();
    var password = passwordInput.value || '';

    errEl.classList.add('hidden');
    errEl.style.color = '';
    if (!email || !password) {
      errEl.textContent = '请输入邮箱和密码';
      errEl.classList.remove('hidden');
      return;
    }
    if (password.length < 6) {
      errEl.textContent = '密码至少 6 位';
      errEl.classList.remove('hidden');
      return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;
    if (forgotBtn) forgotBtn.disabled = true;
    var oldLoginText = loginBtn.textContent;
    var oldRegisterText = registerBtn.textContent;
    loginBtn.textContent = mode === 'login' ? '登录中...' : oldLoginText;
    registerBtn.textContent = mode === 'register' ? '注册中...' : oldRegisterText;

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        var result = await signUp(email, password);
        if (result.needConfirm) {
          renderSignupVerifyModal(email);
          var verifyErr = document.getElementById('signupVerifyError');
          if (verifyErr) {
            verifyErr.textContent = '验证码已发送，请输入邮箱中的验证码完成注册。';
            verifyErr.style.color = '#10B981';
            verifyErr.classList.remove('hidden');
          }
          return;
        }
        await _signOutSilently();
        throw new Error('请先在 Supabase Authentication 中开启邮箱确认，再使用验证码注册');
      }

      hideModal();
      document.getElementById('app').style.display = '';
      if (window._appInitAfterAuth) {
        window._appInitAfterAuth();
      }
    } catch (e) {
      errEl.textContent = e && e.message ? e.message : '操作失败，请稍后重试';
      errEl.classList.remove('hidden');
    } finally {
      loginBtn.disabled = false;
      registerBtn.disabled = false;
      if (forgotBtn) forgotBtn.disabled = false;
      loginBtn.textContent = oldLoginText;
      registerBtn.textContent = oldRegisterText;
    }
  }

  async function handleLogin() {
    return _handleSubmit('login');
  }

  async function handleRegister() {
    return _handleSubmit('register');
  }

  async function handleVerifySignup() {
    var codeInput = document.getElementById('signupCodeInput');
    var btn = document.getElementById('signupVerifyBtn');
    var resendBtn = document.getElementById('signupResendBtn');
    var backBtn = document.getElementById('signupBackBtn');
    var errEl = document.getElementById('signupVerifyError');
    var code = codeInput ? (codeInput.value || '').trim() : '';

    errEl.classList.add('hidden');
    errEl.style.color = '';
    if (!_pendingSignupEmail) {
      errEl.textContent = '缺少注册邮箱，请返回重新注册';
      errEl.classList.remove('hidden');
      return;
    }
    if (!/^\d{6,8}$/.test(code)) {
      errEl.textContent = '请输入邮件中的验证码';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    if (resendBtn) resendBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
    var oldText = btn.textContent;
    btn.textContent = '验证中...';

    try {
      await verifySignupCode(_pendingSignupEmail, code);
      _pendingSignupEmail = '';
      await getCurrentUser();
      await _assertAccountAvailable();
      errEl.textContent = '邮箱验证成功，正在进入刷题助手';
      errEl.style.color = '#10B981';
      errEl.classList.remove('hidden');

      hideModal();
      document.getElementById('app').style.display = '';
      if (window._appInitAfterAuth) {
        window._appInitAfterAuth();
      }
    } catch (e) {
      errEl.textContent = e && e.message ? e.message : '验证失败，请检查验证码后重试';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      if (resendBtn) resendBtn.disabled = false;
      if (backBtn) backBtn.disabled = false;
      btn.textContent = oldText;
    }
  }

  async function handleResendSignupCode() {
    var btn = document.getElementById('signupResendBtn');
    var verifyBtn = document.getElementById('signupVerifyBtn');
    var backBtn = document.getElementById('signupBackBtn');
    var errEl = document.getElementById('signupVerifyError');

    errEl.classList.add('hidden');
    errEl.style.color = '';
    if (!_pendingSignupEmail) {
      errEl.textContent = '缺少注册邮箱，请返回重新注册';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    if (verifyBtn) verifyBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
    var oldText = btn.textContent;
    btn.textContent = '发送中...';

    try {
      await resendSignupCode(_pendingSignupEmail);
      errEl.textContent = '验证码已重新发送，请查看邮箱';
      errEl.style.color = '#10B981';
      errEl.classList.remove('hidden');
    } catch (e) {
      errEl.textContent = e && e.message ? e.message : '发送失败，请稍后重试';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      if (verifyBtn) verifyBtn.disabled = false;
      if (backBtn) backBtn.disabled = false;
      btn.textContent = oldText;
    }
  }

  async function handleForgotPassword() {
    var emailInput = document.getElementById('authEmailInput');
    var loginBtn = document.getElementById('authLoginBtn');
    var registerBtn = document.getElementById('authRegisterBtn');
    var forgotBtn = document.getElementById('authForgotBtn');
    var email = emailInput ? (emailInput.value || '').trim() : '';

    _showAuthMessage('', false);
    if (!email) {
      _showAuthMessage('请输入注册邮箱', true);
      return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;
    forgotBtn.disabled = true;
    var oldForgotText = forgotBtn.textContent;
    forgotBtn.textContent = '发送中...';

    try {
      await sendPasswordReset(email);
      renderRecoveryModal(email);
      var resetErr = document.getElementById('resetPasswordError');
      if (resetErr) {
        resetErr.textContent = '验证码已发送，请查看邮箱中的验证码并在此输入。';
        resetErr.style.color = '#10B981';
        resetErr.classList.remove('hidden');
      }
    } catch (e) {
      _showAuthMessage(e && e.message ? e.message : '发送失败，请稍后重试', true);
    } finally {
      loginBtn.disabled = false;
      registerBtn.disabled = false;
      forgotBtn.disabled = false;
      forgotBtn.textContent = oldForgotText;
    }
  }

  async function handleResetPassword() {
    var codeInput = document.getElementById('resetCodeInput');
    var pwdInput = document.getElementById('resetPasswordInput');
    var confirmInput = document.getElementById('resetPasswordConfirmInput');
    var btn = document.getElementById('resetPasswordBtn');
    var resendBtn = document.getElementById('resetResendBtn');
    var backBtn = document.getElementById('resetBackBtn');
    var errEl = document.getElementById('resetPasswordError');
    var code = codeInput ? (codeInput.value || '').trim() : '';
    var password = pwdInput ? pwdInput.value : '';
    var confirmPassword = confirmInput ? confirmInput.value : '';

    errEl.classList.add('hidden');
    errEl.style.color = '';
    if (!_pendingRecoveryEmail) {
      errEl.textContent = '缺少重置邮箱，请返回重新发送验证码';
      errEl.classList.remove('hidden');
      return;
    }
    if (!/^\d{8}$/.test(code)) {
      errEl.textContent = '请输入 8 位验证码';
      errEl.classList.remove('hidden');
      return;
    }
    if (!password) {
      errEl.textContent = '请输入新密码';
      errEl.classList.remove('hidden');
      return;
    }
    if (password.length < 6) {
      errEl.textContent = '密码至少 6 位';
      errEl.classList.remove('hidden');
      return;
    }
    if (password !== confirmPassword) {
      errEl.textContent = '两次输入的密码不一致';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    if (resendBtn) resendBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
    var oldText = btn.textContent;
    btn.textContent = '保存中...';

    try {
      await verifyRecoveryCode(_pendingRecoveryEmail, code);
      await updatePassword(password);
      _pendingRecoveryEmail = '';
      errEl.textContent = '密码已更新，请使用新密码登录';
      errEl.style.color = '#10B981';
      errEl.classList.remove('hidden');
      setTimeout(function() {
        hideModal();
        renderModal();
      }, 1200);
    } catch (e) {
      errEl.textContent = e && e.message ? e.message : '重置失败，请检查验证码后重试';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      if (resendBtn) resendBtn.disabled = false;
      if (backBtn) backBtn.disabled = false;
      btn.textContent = oldText;
    }
  }

  async function handleResendRecoveryCode() {
    var btn = document.getElementById('resetResendBtn');
    var resetBtn = document.getElementById('resetPasswordBtn');
    var backBtn = document.getElementById('resetBackBtn');
    var errEl = document.getElementById('resetPasswordError');

    errEl.classList.add('hidden');
    errEl.style.color = '';
    if (!_pendingRecoveryEmail) {
      errEl.textContent = '缺少重置邮箱，请返回登录后重新输入';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
    var oldText = btn.textContent;
    btn.textContent = '发送中...';

    try {
      await sendPasswordReset(_pendingRecoveryEmail);
      errEl.textContent = '验证码已重新发送，请查看邮箱';
      errEl.style.color = '#10B981';
      errEl.classList.remove('hidden');
    } catch (e) {
      errEl.textContent = e && e.message ? e.message : '发送失败，请稍后重试';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      if (resetBtn) resetBtn.disabled = false;
      if (backBtn) backBtn.disabled = false;
      btn.textContent = oldText;
    }
  }

  function hideModal() {
    var overlay = document.getElementById('activationOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  _bindAuthListener();

  return {
    getCurrentUser: getCurrentUser,
    getCurrentUserId: getCurrentUserId,
    getCurrentUserEmail: getCurrentUserEmail,
    getCurrentProfile: getCurrentProfile,
    ensureProfile: ensureProfile,
    isAdmin: isAdmin,
    isBanned: isBanned,
    signOut: signOut,
    renderModal: renderModal,
    renderRecoveryModal: renderRecoveryModal,
    renderSignupVerifyModal: renderSignupVerifyModal,
    hideModal: hideModal,
    handleLogin: handleLogin,
    handleRegister: handleRegister,
    handleVerifySignup: handleVerifySignup,
    handleResendSignupCode: handleResendSignupCode,
    handleForgotPassword: handleForgotPassword,
    handleResetPassword: handleResetPassword,
    handleResendRecoveryCode: handleResendRecoveryCode
  };
})();
