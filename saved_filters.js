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

    var pendingSave = null; // {summary} while "save & search" waits for the filter's activity

    function t(key) { return Lampa.Lang.translate(key); }

    function load() { return Lampa.Storage.get(STORAGE_KEY, '[]') || []; }
    function store(list) { Lampa.Storage.set(STORAGE_KEY, list); }

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

    function showList(onBack) {
        var list = load();
        var items = list.map(function (f, i) {
            return { title: f.name, subtitle: f.summary || f.source, index: i };
        });

        if (!items.length) items.push({ title: t('saved_filters_empty'), subtitle: t('saved_filters_hint'), empty: true });

        Lampa.Select.show({
            title: t('saved_filters_title'),
            items: items,
            onBack: onBack,
            onSelect: function (a) {
                if (a.empty) onBack();
                else open(list[a.index]);
            },
            // Long press (OK held) deletes.
            onLong: function (a) {
                if (a.index === undefined) return;
                list.splice(a.index, 1);
                store(list);
                Lampa.Noty.show(t('saved_filters_deleted'));
                showList(onBack);
            }
        });
    }

    // "Фильм, от 6, Комедия" from the subtitles the filter menu already rendered.
    function summarize(items) {
        var none = t('nochoice');
        return items.filter(function (g) { return g.items && g.subtitle && g.subtitle !== none; })
            .map(function (g) { return g.subtitle; }).join(', ');
    }

    function isFilterMenu(params) {
        return params && params.title === t('title_filter') && params.items &&
            params.items.some(function (i) { return i.search; });
    }

    function isFilterActivity(a) {
        return a && a.component === 'category_full' && typeof a.url === 'string' &&
            (a.url.indexOf('discover') === 0 || a.url.indexOf('?cat=') === 0);
    }

    function askNameAndSave(activity, summary) {
        Lampa.Input.edit({ title: t('saved_filters_name'), value: summary, free: true, nosave: true }, function (name) {
            Lampa.Controller.toggle('content');
            if (!name) return;
            var list = load();
            list.push({ name: name, summary: summary, url: activity.url, source: activity.source });
            store(list);
            Lampa.Noty.show(t('saved_filters_saved'));
        });
    }

    // Add "Save & search" and "My filters" to the built-in filter menu.
    function patchSelect() {
        var origShow = Lampa.Select.show;

        Lampa.Select.show = function (params) {
            if (isFilterMenu(params) && !params.saved_filters) {
                var origOnSelect = params.onSelect;
                var count = load().length;
                var at = params.items.findIndex(function (i) { return i.search; }) + 1;

                params.saved_filters = true;
                params.items.splice(at, 0,
                    { title: t('saved_filters_save'), sf_save: true },
                    { title: t('saved_filters_title'), subtitle: count ? String(count) : t('saved_filters_none'), sf_list: true }
                );
                params.onSelect = function (a) {
                    if (a.sf_save) {
                        pendingSave = { summary: summarize(params.items) };
                        origOnSelect({ search: true });
                    }
                    else if (a.sf_list) showList(function () { origShow.call(Lampa.Select, params); });
                    else origOnSelect(a);
                };
            }
            return origShow.apply(this, arguments);
        };
    }

    // Catch the activity the filter's search() pushes/replaces, when we asked to save it.
    function patchActivity() {
        ['push', 'replace'].forEach(function (method) {
            var orig = Lampa.Activity[method];
            Lampa.Activity[method] = function (object) {
                var result = orig.apply(this, arguments);
                if (pendingSave && isFilterActivity(object)) {
                    var summary = pendingSave.summary;
                    pendingSave = null;
                    setTimeout(function () { askNameAndSave(object, summary); }, 300);
                }
                return result;
            };
        });
    }

    function addMenuItem() {
        var button = $('<li class="menu__item selector">' +
            '<div class="menu__ico">' + ICON + '</div>' +
            '<div class="menu__text">' + t('saved_filters_title') + '</div>' +
            '</li>');

        button.on('hover:enter', function () {
            showList(function () { Lampa.Controller.toggle('menu'); });
        });

        var builtin = $('.menu .menu__item[data-action="filter"]');
        if (builtin.length) builtin.eq(0).after(button);
        else $('.menu .menu__list').eq(0).append(button);
    }

    function start() {
        if (window.saved_filters_plugin) return;
        window.saved_filters_plugin = true;

        Lampa.Lang.add({
            saved_filters_title:   { ru: 'Мои фильтры', en: 'Saved filters', uk: 'Мої фільтри' },
            saved_filters_save:    { ru: 'Сохранить и искать', en: 'Save & search', uk: 'Зберегти і шукати' },
            saved_filters_name:    { ru: 'Название фильтра', en: 'Filter name', uk: 'Назва фільтра' },
            saved_filters_saved:   { ru: 'Фильтр сохранён', en: 'Filter saved', uk: 'Фільтр збережено' },
            saved_filters_deleted: { ru: 'Фильтр удалён', en: 'Filter deleted', uk: 'Фільтр видалено' },
            saved_filters_empty:   { ru: 'Нет сохранённых фильтров', en: 'No saved filters', uk: 'Немає збережених фільтрів' },
            saved_filters_none:    { ru: 'Пусто', en: 'Empty', uk: 'Порожньо' },
            saved_filters_hint:    { ru: 'Фильтр → выберите параметры → «Сохранить и искать»', en: 'Filter → pick options → “Save & search”', uk: 'Фільтр → оберіть параметри → «Зберегти і шукати»' }
        });

        patchSelect();
        patchActivity();

        if (window.appready) addMenuItem();
        else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') addMenuItem(); });
    }

    start();
})();
