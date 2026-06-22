document.addEventListener("DOMContentLoaded", function() {
    EventBus.subscribe("eventLoader", () => {
        EM_Module.Badges.renderBadgesInHTML($widget);
    });
});