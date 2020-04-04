const Meta = imports.gi.Meta;

/* This has been tested with dynamic workspaces.  It
 * works with dynamic workspaces, but can work well if you have
 * enough static ones.
 */

/* Possible future options:
 *  Track each instance of application in history
 *  Move workspaces that start maximized
 *  target a specific desktop when none are empty
 *  (don't) skip first desktop
 */


const change_workspace = (win, manager, index) => {
  const n = manager.get_n_workspaces();
  if (n <= index) {
    return;
  }
  win.change_workspace_by_index(index, 1);
  manager.get_workspace_by_index(index).activate(global.get_current_time());
};

const _old_workspaces = {};

const first_empty_workspace_index = (manager) => {
  const n = manager.get_n_workspaces();
  let lastworkspace = n - 1;
  for (let i = 0; i < lastworkspace; ++i) {
    let win_count = manager.get_workspace_by_index(i)
              .list_windows()
              .filter(w => !w.is_always_on_all_workspaces()).length;
    if (win_count < 1) { return i; }
  }
  // return last workspace by default, but always start with 1 
  if (lastworkspace<1) lastworkspace=1
  return lastworkspace;
}

function check(act) {
  const win = act.meta_window;
  const workspacemanager = win.get_display().get_workspace_manager();
  if (win.window_type !== Meta.WindowType.NORMAL)
    return;
  if (win.get_maximized() !== Meta.MaximizeFlags.BOTH) {
    // Check if it was maximized before
    let name = win.get_gtk_unique_bus_name();
    if (_old_workspaces[name] !== undefined) {
      change_workspace(win, workspacemanager, _old_workspaces[name]);
      _old_workspaces[name] = undefined;  // remove it from array since we revert it back
    }
    return;
  }
  w = win.get_workspace().list_windows()
    .filter(w => w!==win && !w.is_always_on_all_workspaces());
  if (w.length>= 1) {
    let emptyworkspace = first_empty_workspace_index(workspacemanager);

    // don't try to move it if we're already here
    if (emptyworkspace == win.get_workspace().index())
      return;

    let name = win.get_gtk_unique_bus_name();
    _old_workspaces[name] = win.get_workspace().index();
    change_workspace(win, workspacemanager, emptyworkspace);
  }
}

const _handles = [];

function enable() {
  _handles.push(global.window_manager.connect('map', (_, act) => {
    check(act);
  }));
  _handles.push(global.window_manager.connect('size-change', (_, act, change) => {
    if (change === Meta.SizeChange.MAXIMIZE)
      check(act);
    if (change === Meta.SizeChange.UNMAXIMIZE)
      check(act);
  }));
}

function disable() {
  _handles.splice(0).forEach(h => global.window_manager.disconnect(h));
}
