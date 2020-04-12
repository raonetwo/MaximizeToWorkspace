const Meta = imports.gi.Meta;

/* This has been tested with dynamic workspaces. It works well with dynamic workspaces, 
 * but can work well  with static if you have
 * enough static ones.
 */

/* Possible future options:
 *  Move workspaces that start maximized
 *  Target a specific desktop when none are empty (for static, not in immediate roadmap)
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

const first_empty_workspace_index = (manager, win) => {
  const n = manager.get_n_workspaces();
  let lastworkspace = n - 1;
  for (let i = 0; i < lastworkspace; ++i) {
    let win_count = manager.get_workspace_by_index(i)
              .list_windows()
              .filter(w => !w.is_always_on_all_workspaces() && win.get_monitor()==w.get_monitor()).length;
    if (win_count < 1) { return i; }
  }
  // return last workspace by default, but always start with 1 
  if (lastworkspace<1) lastworkspace=1
  return lastworkspace;
}

function check(win) {
  const workspacemanager = win.get_display().get_workspace_manager();
  if (win.window_type !== Meta.WindowType.NORMAL)
    return;
  if (win.get_maximized() !== Meta.MaximizeFlags.BOTH) {
    // Check if it was maximized before
    let name = win.get_id();
    if (_old_workspaces[name] !== undefined) {
      // go back to the original workspace
      change_workspace(win, workspacemanager, _old_workspaces[name]);
      _old_workspaces[name] = undefined;  // remove it from array since we revert it back
    }
    return;
  }
  let w = win.get_workspace().list_windows()
    .filter(w => w!==win && !w.is_always_on_all_workspaces() && win.get_monitor()==w.get_monitor());
  // Check if movement is required based on the number of windows present on current workspace
  if (w.length>= 1) {
    let emptyworkspace = first_empty_workspace_index(workspacemanager, win);

    // don't try to move it if we're already here
    if (emptyworkspace == win.get_workspace().index())
      return;

    // Save window location history
    let name = win.get_id();
    _old_workspaces[name] = win.get_workspace().index();
    // change workspace
    change_workspace(win, workspacemanager, emptyworkspace);
  }
}

function checkFullScreen(win) {
  if(win.get_maximized() === Meta.MaximizeFlags.BOTH
    && _old_workspaces[win.get_id()] === undefined
    && win.has_focus()) {
    check(win);
  }
}

const _window_manager_handles = [];
const _display_handles = [];

function enable() {
  _display_handles.push(global.display.connect('window-created', (_, win) => {
    if(win.get_layer() !== Meta.StackLayer.NORMAL || win.get_frame_type() !== Meta.FrameType.NORMAL){
      return;
    }
    global.run_at_leisure(checkFullScreen.bind(this, win));
  }));
  _window_manager_handles.push(global.window_manager.connect('size-change', (_, act, change) => {
    if (change === Meta.SizeChange.MAXIMIZE)
      check(act.meta_window);
    if (change === Meta.SizeChange.UNMAXIMIZE)
      check(act.meta_window);
  }));
}

function disable() {
  _window_manager_handles.splice(0).forEach(h => global.window_manager.disconnect(h));
  _display_handles.splice(0).forEach(h => global.display.disconnect(h));
}
