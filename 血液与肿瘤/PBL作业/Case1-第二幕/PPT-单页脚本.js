/*
 * 文件作用：
 * 1. 为拆分后的单页 PPT 提供统一的 16:9 缩放逻辑。
 * 2. 让每一页仍然保留“页内动画步进”的演示体验。
 * 3. 因为每个 HTML 只承载一页，所以这里只处理 step，不再处理多页切换。
 *
 * 使用方式：
 * - 页面里把需要逐步出现的元素写成 class="step"。
 * - 初始状态不显示；右侧点击、回车、空格、右方向键会显示下一步。
 * - 左侧点击、退格、左方向键会回退上一步。
 */

document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('presentation-area');
    const slide = document.querySelector('.slide');
    const steps = slide ? Array.from(slide.querySelectorAll('.step')) : [];
    let currentStepIndex = -1;

    /*
     * 这个查询参数只用于测试和导出最终画面：
     * - ?step=all   表示一次性展开全部步进元素；
     * - ?step=2     表示直接展开到第 2 步（从 1 开始计数）。
     * 正常上课演示时不带参数，页面行为不会变。
     */
    const searchParams = new URLSearchParams(window.location.search);
    const presetStep = searchParams.get('step');

    if (presetStep === 'all') {
        currentStepIndex = steps.length - 1;
    } else if (presetStep !== null) {
        const parsedStep = Number.parseInt(presetStep, 10);

        if (Number.isFinite(parsedStep)) {
            currentStepIndex = Math.max(-1, Math.min(steps.length - 1, parsedStep - 1));
        }
    }

    function resizePresentation() {
        const targetRatio = 16 / 9;
        const windowRatio = window.innerWidth / window.innerHeight;
        const scale = windowRatio > targetRatio
            ? window.innerHeight / 1080
            : window.innerWidth / 1920;

        area.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    function updateSteps() {
        steps.forEach((stepNode, stepNodeIndex) => {
            stepNode.classList.toggle('visible', stepNodeIndex <= currentStepIndex);
        });
    }

    function nextStep() {
        if (currentStepIndex < steps.length - 1) {
            currentStepIndex += 1;
            updateSteps();
        }
    }

    function prevStep() {
        if (currentStepIndex >= 0) {
            currentStepIndex -= 1;
            updateSteps();
        }
    }

    window.addEventListener('resize', resizePresentation);
    resizePresentation();
    updateSteps();

    document.addEventListener('keydown', (event) => {
        if (['ArrowRight', 'Space', 'Enter', 'PageDown'].includes(event.key)) {
            nextStep();
        } else if (['ArrowLeft', 'Backspace', 'PageUp'].includes(event.key)) {
            prevStep();
        }
    });

    let startX = 0;
    document.addEventListener('touchstart', (event) => {
        startX = event.changedTouches[0].screenX;
    }, { passive: false });

    document.addEventListener('touchend', (event) => {
        const endX = event.changedTouches[0].screenX;

        if (startX - endX > 50) {
            nextStep();
        } else if (endX - startX > 50) {
            prevStep();
        } else if (Math.abs(startX - endX) < 10) {
            if (endX > window.innerWidth / 2) {
                nextStep();
            } else {
                prevStep();
            }
        }
    }, { passive: false });

    document.addEventListener('click', (event) => {
        const lastClickTime = window.lastClickTime || 0;

        if (Date.now() - lastClickTime < 300) {
            return;
        }

        window.lastClickTime = Date.now();

        if (event.clientX > window.innerWidth / 2) {
            nextStep();
        } else {
            prevStep();
        }
    });

    document.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        prevStep();
    });

    document.addEventListener('dblclick', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    });
});
