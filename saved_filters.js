(function () {
    'use strict';

    // Lampa's built-in Filter (menu -> Фильтр) ends in an activity
    // {component:'category_full', source, url:'discover/...' | '?cat=...'}.
    // ponytail: we save that activity, not the filter checkboxes, so reopening is one Activity.push.
    var STORAGE_KEY = 'saved_filters';

    var ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M17 14l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4L17 14z" fill="currentColor"/>' +
        '</svg>';

    function t(key) { return Lampa.Lang.translate(key); }

    function load() { return Lampa.Storage.get(STORAGE_KEY, '[]') || []; }
    function store(list) { Lampa.Storage.set(STORAGE_KEY, list); }

    function isFilterResult(a) {
        return a && a.component === 'category_full' && typeof a.url === 'string' &&
            (a.url.indexOf('discover') === 0 || a.url.indexOf('?cat=') === 0);
    }

    function open(f) {
        Lampa.Activity.push({
            url: f.url,
            title: f.name,
            component: 'category_full',
            source: f.source,
            card_type: true,
            page: 1
        });
    }

    function saveCurrent(active) {
        Lampa.Input.edit({ title: t('saved_filters_name'), value: '', free: true, nosave: true }, function (name) {
            if (!name) return showList();
            var list = load();
            list.push({ name: name, url: active.url, source: active.source });
            store(list);
            Lampa.Noty.show(t('saved_filters_saved'));
            showList();
        });
    }

    function showList() {
        var active = Lampa.Activity.active();
        var list = load();
        var items = [];

        if (isFilterResult(active)) items.push({ title: t('saved_filters_save'), save: true });

        list.forEach(function (f, i) {
            items.push({ title: f.name, subtitle: f.source, index: i });
        });

        if (!items.length) items.push({ title: t('saved_filters_empty'), subtitle: t('saved_filters_hint'), empty: true });

        Lampa.Select.show({
            title: t('saved_filters_title'),
            items: items,
            onBack: function () { Lampa.Controller.toggle('menu'); },
            onSelect: function (a) {
                if (a.save) saveCurrent(active);
                else if (a.empty) Lampa.Controller.toggle('menu');
                else open(list[a.index]);
            },
            // Long press (OK held) deletes.
            onLong: function (a) {
                if (a.index === undefined) return;
                list.splice(a.index, 1);
                store(list);
                Lampa.Noty.show(t('saved_filters_deleted'));
                showList();
            }
        });
    }

    function addMenuItem() {
        var button = $('<li class="menu__item selector">' +
            '<div class="menu__ico">' + ICON + '</div>' +
            '<div class="menu__text">' + t('saved_filters_title') + '</div>' +
            '</li>');

        button.on('hover:enter', showList);

        var builtin = $('.menu .menu__item[data-action="filter"]');
        if (builtin.length) builtin.eq(0).after(button);
        else $('.menu .menu__list').eq(0).append(button);
    }

    function start() {
        if (window.saved_filters_plugin) return;
        window.saved_filters_plugin = true;

        Lampa.Lang.add({
            saved_filters_title:   { ru: 'Мои фильтры', en: 'Saved filters', uk: 'Мої фільтри' },
            saved_filters_save:    { ru: 'Сохранить текущий фильтр', en: 'Save current filter', uk: 'Зберегти поточний фільтр' },
            saved_filters_name:    { ru: 'Название фильтра', en: 'Filter name', uk: 'Назва фільтра' },
            saved_filters_saved:   { ru: 'Фильтр сохранён', en: 'Filter saved', uk: 'Фільтр збережено' },
            saved_filters_deleted: { ru: 'Фильтр удалён', en: 'Filter deleted', uk: 'Фільтр видалено' },
            saved_filters_empty:   { ru: 'Нет сохранённых фильтров', en: 'No saved filters', uk: 'Немає збережених фільтрів' },
            saved_filters_hint:    { ru: 'Примените фильтр и откройте это меню', en: 'Apply a filter, then open this menu', uk: 'Застосуйте фільтр і відкрийте це меню' }
        });

        if (window.appready) addMenuItem();
        else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') addMenuItem(); });
    }

    start();
})();
