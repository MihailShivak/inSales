document.addEventListener("DOMContentLoaded", function() {

    function isTimeInRange(start, end) {
        if (!start || !end) return false;

        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);

        const startTotalMinutes = startHour * 60 + startMin;
        const endTotalMinutes = endHour * 60 + endMin;
        
        return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    }

    // Проверить сколько прошло с прошлого открытия попапа
    function checkAndUpdateLastVisit(lastVisitTimeWarning, isSetTime = false) {
        const HALF_DAY_MS = 60 * 60 * 1000; // 1 час
        const now = Date.now();

        if (!lastVisitTimeWarning || lastVisitTimeWarning === "false") {
            if (isSetTime) localStorage.setItem("lastVisitTimeWarning", String(now));
            return true;
        }

        const lastTime = Number(lastVisitTimeWarning);

        if (isNaN(lastTime) || (now - lastTime) >= HALF_DAY_MS) {
            // прошло больше пол суток
            if (isSetTime) localStorage.setItem("lastVisitTimeWarning", String(now));
            return true;
        }

        // меньше пол суток
        return false;
    }

    function openModalWarningTime() {
        const popup = document.getElementById("popup-message-warning");
        if (!popup) return;

        const lastVisitTimeWarning = localStorage.getItem("lastVisitTimeWarning");

        if (!checkAndUpdateLastVisit(lastVisitTimeWarning)) return;
        
        const warningModal = new EM_Module.Modal(popup);

        warningModal.init(undefined, () => {
            checkAndUpdateLastVisit(lastVisitTimeWarning, true);
        });
        warningModal.open();
    }

    openModalWarningTime();
});