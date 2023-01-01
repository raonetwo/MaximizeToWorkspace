const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;

/* This has been tested with dynamic workspaces. It works well with dynamic workspaces, but can work well with static if you have enough static ones.
 * Works well with external monitor as well, the idea being windows opened on external monitor are meant for just that monitor.
 * Any caveats that come with the way gnome handles multi monitor setups will remain as we do not try to address those here.
 */

/* Possible future options:
 *  Target a specific desktop when none are empty (for static, not in immediate roadmap). People can create issues with feature requests if they want.
 *  (don't) skip first desktop
 *  Expose some of the hard coded things as preferences if someones asks for them.
 */

// As the name suggests this function changes the workspace of the window to the provided index using the provided window manager.
const change_workspace = (win, manager, index) => {
  const n = manager.get_n_workspaces();
  if (n <= index) {
    return;
  }
  win.change_workspace_by_index(index, 1);
  manager.get_workspace_by_index(index).activate(global.get_current_time());
};

// This object stores mapping of the windows, workspaces, 
// This by nature make the window state management of this extension ephemeral
// So if gnome desktop crash for whatever reason the history will be lost
// TODO read and write from a file.
const _old_workspaces = {};

// This object stores mapping of the windows that were maximized and their workspaces, 
// we do not want to pollute the original map for maximize and minimize.
const _full_screen_apps = {};

// This function gets the index of first empty workspace available for a window to be put on using the provided window manager
// Relying on the fact that the last window will be left empty in case of dynamic workspace by gnome so we would always find one.
const first_empty_workspace_index = (manager, win) => {
  const n = manager.get_n_workspaces();
  let lastworkspace = n - 1;
  for (let i = 0; i < lastworkspace; ++i) {
    let win_count = manager.get_workspace_by_index(i)
      .list_windows()
      .filter(w => !w.is_always_on_all_workspaces() && win.get_monitor() == w.get_monitor()).length;
    if (win_count < 1) {
      return i;
    }
  }
  // return last workspace by default, but always start with 1, possible programming bug that comes from the relic code
  if (lastworkspace < 1) lastworkspace = 1
  return lastworkspace;
}

// TODO name this function better
// TODO break function into smaller functions
function check(win, change) {
  const workspacemanager = win.get_display().get_workspace_manager();
  // Ensure that the window is normal
  if (win.window_type !== Meta.WindowType.NORMAL) {
    return;
  }
  // key name we will use to store in map here it is Id.
  const name = win.get_id();
  // get list of other windows in the current workspace and the current display
  // TODO name this variable better.
  const w = win.get_workspace().list_windows()
    .filter(w => w !== win && !w.is_always_on_all_workspaces() && win.get_monitor() == w.get_monitor());
  // check if this method was called for a window that is not maximized
  // TODO this should be moved out into a separate function and unmaximized signal should be process with that function
  if (change === Meta.SizeChange.UNFULLSCREEN || change === Meta.SizeChange.UNMAXIMIZE || (change === Meta.SizeChange.MAXIMIZE && win.get_maximized() !== Meta.MaximizeFlags.BOTH)) {
    // check if the app was previously full screened? 
    // We handle maximize and full screen separately.
    // TODO code clean up create clean short functions.
    if (_full_screen_apps[name] !== undefined) {
      if (w.length == 0) {
        change_workspace(win, workspacemanager, _full_screen_apps[name]);
      }
      _full_screen_apps[name] = undefined;
      return;
    }
    // If the window is unmaximized, check if it was maximized before as we will want it to be returned to its original workspace
    if (_old_workspaces[name] !== undefined) {
      // go back to the original workspace only if no other window is present in the workspace
      // if another window is present on the current workspace it is likely that we unmaximized current window to work with them side by side 
      if (w.length == 0) { // TODO expose this as user choice
        change_workspace(win, workspacemanager, _old_workspaces[name]);
      }
      // remove it from array since we moved it back to its original workspace 
      // or we are working with other windows on the same workspace and this workspace will now become its original workspace if we maximize it in future
      _old_workspaces[name] = undefined;
    }
    return;
  }
  // save windows with events of FullScreen and maximize to their respective maps to save window location history
  if (change === Meta.SizeChange.FULLSCREEN) {
    _full_screen_apps[name] = win.get_workspace().index();
  } else {
    _old_workspaces[name] = win.get_workspace().index();
  }
  // Check if movement is required based on the number of windows present on current workspace
  if (w.length >= 1) {
    let emptyworkspace = first_empty_workspace_index(workspacemanager, win);

    // don't try to move it if we're already here
    if (emptyworkspace == win.get_workspace().index())
      return;

    // change workspace
    change_workspace(win, workspacemanager, emptyworkspace);
  }
}

// Does as the name suggests, brings you back to the workspace you started in.
function handleWindowClose(act) {
  let win = act.meta_window;
  let name = win.get_id();
  if (_old_workspaces[name] !== undefined) {
    win.get_display().get_workspace_manager().get_workspace_by_index(_old_workspaces[name]).activate(global.get_current_time());
  }
};

// need to understand "handles", these are just object arrays to store the "handles" that connect with signals
const _window_manager_handles = [];

// Runs when the extension is enabled, basically connects to the signals and save the handles
// whenever the signal is emitted our connected handles, process the signal.
function enable() {
  // removing delay and using map again
  _window_manager_handles.push(global.window_manager.connect('map', (_, act, change) => {
    if (act.meta_window.get_maximized() === Meta.MaximizeFlags.BOTH) {
      check(act.meta_window, change);
    }
  }));
  // Add size-change event handler for windows that are already created.
  _window_manager_handles.push(global.window_manager.connect('size-change', (_, act, change) => {
    // check(act.meta_window, change);
    GLib.timeout_add(GLib.PRIORITY_LOW, 300, check.bind(this, act.meta_window, change));
  }));
  _window_manager_handles.push(global.window_manager.connect('destroy', (_, act) => {
    handleWindowClose(act);
  }));
}

// As the name suggests, runs when extension is disabled, basically disconnect the handles.
function disable() {
  // Why is the splice required? well we are emptying the array, can't really say what will happen if we do not use splice 
  // as I did not try it, this came from the legacy code, I suspect if we reenable the extension there might be issues.

  // we just disconnet the handlers for the events.
  _window_manager_handles.splice(0).forEach(h => global.window_manager.disconnect(h));
}
