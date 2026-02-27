/**
 * Activation Code Module
 * Manages device activation with single-use codes stored in Supabase
 */
var Activation = (function() {
  // 20 unique activation codes
  var VALID_CODES = [
    'HJ1237-AXKM-7F2D',
    'HJ1237-BWPN-3G8E',
    'HJ1237-CQRL-9H4J',
    'HJ1237-DTSV-5K6M',
    'HJ1237-EUYB-2L1N',
    'HJ1237-FVZC-8P3Q',
    'HJ1237-GWAD-4R7S',
    'HJ1237-HXBE-6T9U',
    'HJ1237-JYCF-1V5W',
    'HJ1237-KZDG-3X8Y',
    'HJ1237-LAEH-7Z2A',
    'HJ1237-MBFJ-9C4D',
    'HJ1237-NCGK-5E6F',
    'HJ1237-PDHL-2G1H',
    'HJ1237-QEJM-8J3K',
    'HJ1237-RFKN-4L7M',
    'HJ1237-SGLP-6N9P',
    'HJ1237-THMQ-1Q5R',
    'HJ1237-UJNR-3S8T',
    'HJ1237-VKPS-9U2V'
  ];

  var STORAGE_KEY = 'device_activated_code';

  /**
   * Check if current device is activated (local check only)
   */
  function isActivated() {
    var code = localStorage.getItem(STORAGE_KEY);
    return code && VALID_CODES.indexOf(code) !== -1;
  }

  /**
   * Get the stored activation code
   */
  function getStoredCode() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  /**
   * Activate device with a code
   * Returns { success: boolean, message: string }
   */
  async function activate(code) {
    code = (code || '').trim().toUpperCase();

    // 1. Check if code is in valid list
    if (VALID_CODES.indexOf(code) === -1) {
      return { success: false, message: '激活码无效，请检查后重新输入' };
    }

    try {
      // 2. Check if code is already used in Supabase
      var { data, error } = await supabase
        .from('activation_codes')
        .select('device_id')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Code already used
        if (data.device_id === DEVICE_ID) {
          // Same device - allow re-activation
          localStorage.setItem(STORAGE_KEY, code);
          return { success: true, message: '激活成功' };
        } else {
          // Different device - reject
          return { success: false, message: '该激活码已被其他设备使用' };
        }
      }

      // 3. Code not used yet - register it
      var { error: insertErr } = await supabase
        .from('activation_codes')
        .insert({ code: code, device_id: DEVICE_ID });

      if (insertErr) throw insertErr;

      // 4. Store locally
      localStorage.setItem(STORAGE_KEY, code);
      return { success: true, message: '激活成功' };

    } catch (e) {
      console.error('Activation error:', e);
      return { success: false, message: '网络错误，请稍后重试' };
    }
  }

  /**
   * Deactivate current device - clears local storage and reloads
   */
  function deactivate() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  /**
   * Render the activation modal overlay
   */
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
        '<h2 class="activation-title">设备激活</h2>' +
        '<p class="activation-desc">请输入激活码以使用刷题助手</p>' +
        '<input type="text" id="activationInput" class="activation-input" placeholder="请输入激活码" autocomplete="off" autocapitalize="characters">' +
        '<div class="activation-error hidden" id="activationError"></div>' +
        '<button class="btn btn-primary btn-block activation-btn" id="activationBtn" onclick="Activation.handleActivate()">激活</button>' +
      '</div>';

    // Focus input
    setTimeout(function() {
      var input = document.getElementById('activationInput');
      if (input) input.focus();
    }, 300);

    // Enter key support
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        Activation.handleActivate();
      }
    });
  }

  /**
   * Handle activate button click
   */
  async function handleActivate() {
    var input = document.getElementById('activationInput');
    var btn = document.getElementById('activationBtn');
    var errEl = document.getElementById('activationError');
    var code = input.value.trim();

    if (!code) {
      errEl.textContent = '请输入激活码';
      errEl.classList.remove('hidden');
      return;
    }

    // Disable button during request
    btn.disabled = true;
    btn.textContent = '验证中...';
    errEl.classList.add('hidden');

    var result = await activate(code);

    if (result.success) {
      // Hide overlay, show app
      hideModal();
      document.getElementById('app').style.display = '';
      // Trigger app init
      if (window._appInitAfterActivation) {
        window._appInitAfterActivation();
      }
    } else {
      errEl.textContent = result.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = '激活';
    }
  }

  /**
   * Hide the activation modal
   */
  function hideModal() {
    var overlay = document.getElementById('activationOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  return {
    isActivated: isActivated,
    activate: activate,
    deactivate: deactivate,
    renderModal: renderModal,
    handleActivate: handleActivate,
    hideModal: hideModal,
    getStoredCode: getStoredCode
  };
})();
