const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;

/* This has been tested with dynamic workspaces. It works well with dynamic workspaces, 
 * but can work well  with static if you have enough static ones.
 * Works well with external monitor as well, 
 * the idea being windows opened on external monitor are meant for just that monitor.
 * Any caveats that come with the way gnome handles multi monitor setups will remain
 * as we do not try to address  those here. However, we can open issues to track any nuances if found.
 * If there are any problems we can create an issue to track that.
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

// This function gets the index of first empty workspace available for a window to be put on using the provided window manager
// Relying on the fact that the last window will be left empty in case of dynamic workspace by gnome so we would always find one.
const first_empty_workspace_index = (manager, win) => {
  const n = manager.get_n_workspaces();
  let lastworkspace = n - 1;
  for (let i = 0; i < lastworkspace; ++i) {
    let win_count = manager.get_workspace_by_index(i)
              .list_windows()
              .filter(w => !w.is_always_on_all_workspaces() && win.get_monitor()==w.get_monitor()).length;
    if (win_count < 1) { return i; }
  }
  // return last workspace by default, but always start with 1, possible programming bug that comes from the relic code
  if (lastworkspace<1) lastworkspace=1
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
  // get list of other windows in the current workspace and the current display
  // TODO name this variable better.
  let w = win.get_workspace().list_windows()
    .filter(w => w!==win && !w.is_always_on_all_workspaces() && win.get_monitor()==w.get_monitor());
  // check if this method was called for a window that is not maximized
  // TODO this should be moved out into a separate function and unmaximized signal should be process with that function
  if (change === Meta.SizeChange.UNFULLSCREEN || change === Meta.SizeChange.UNMAXIMIZE) {
    // If the window is unmaximized, check if it was maximized before as we will want it to be returned to its original workspace
    let name = win.get_id();
    if (_old_workspaces[name] !== undefined) {
      // go back to the original workspace only if no other window is present in the workspace
      // if another window is present on the current workspace it is likely that we unmaximized current window to work with them side by side 
      if (w.length == 0) {  // TODO expose this as user choice
        change_workspace(win, workspacemanager, _old_workspaces[name]);
      }
      // remove it from array since we moved it back to its original workspace 
      // or we are working with other windows on the same workspace and this workspace will now become its original workspace if we maximize it in future
      _old_workspaces[name] = undefined;
    }
    return;
  }
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

// This function is for handling newly created windows that start maximized TODO: name better
// The better approach would have been only to trigger the check function when the window is "ready".
// I have faced a lot of rendering issues while working with this, likely because of my lack of knowledge of gnome.
// and more so by the lack of documentation in the JS API, 
// since I did not bother reading the long prose in other pieces of documentation which looked incomplete anyways.
// e.g the window got maximized and moved to a new workspace but was not rendered in the desktop/workspace, 
// so you are left staring at your desktop background but your keyboard and mouse are interacting with the app.
// it showed up correctly in preview in the dock and application overview (when you press super) but not on the desktop
// back then I had to minimize and unminimize the window to get it to render. story from gnome 3.34 
function checkFullScreen(win) {
  // stuff from trial and error lies below, this works but I didn't bother cleaning it up and check what is required and what is not
  // basically we are checking if window is ready to be put to new workspace before trying to do just that
  if (!win || !win.get_workspace()) {
    return false;
  }
  // I should read the documentation for this to add a meaningful comment
  // basically we are checking if its "visible" and "allocated" need to read the doc to understand what it means
  // as I said, stuff from trial and error. HEHE
  var windowActor = win.get_compositor_private();
  if (!windowActor || !windowActor.visible || !windowActor.has_allocation()) {
    return false;
  }
  // Check if this is a maximized window and it is indeed a new window and we haven't seen it before and it has "focus" whatever that means. TODO read the docs if they exist
  if(win.get_maximized() === Meta.MaximizeFlags.BOTH
    && _old_workspaces[win.get_id()] === undefined
    && win.has_focus()) {
    check(win, Meta.SizeChange.MAXIMIZE);
  }
  return false;
}

function handleWindowClose(act) {
    let win = act.meta_window;
    let name = win.get_id();
    if (_old_workspaces[name] !== undefined) {
      win.get_display().get_workspace_manager().get_workspace_by_index(_old_workspaces[name]).activate(global.get_current_time());
    }
};

// need to understand "handles", these are just object arrays to store the "handles" that connect with signals
const _window_manager_handles = [];
const _display_handles = [];

// Runs when the extension is enabled, basically connects to the signals and save the handles
// whenever the signal is emitted our connected handles, process the signal.
// Again need to check the documentation on how this works, this was part of the relic code, this project is "inspired" by
function enable() {
  // add the window created event handler to the array.
  _display_handles.push(global.display.connect('window-created', (_, win) => {
    // There are some wierd windows, trying to move which result in gnome shell crash as they get closed while we are trying to move them
    // found this check through trial and error as I didn't read the doc (someone send me the link already)
    if(win.get_layer() !== Meta.StackLayer.NORMAL){
      return;
    }
    // Another check that arose from trial and error, if someone wants to check their similar extension they should try opening Unity Game Editor on ubuntu
    // and open a new firefox private window.
    // Need to ensure that the frameless window does not need to be moved as most of such windows are transient
    if(win.get_frame_type() !== Meta.FrameType.NORMAL && win.get_frame_type() !== Meta.FrameType.BORDER){
      return;
    }
    // This is required to add a delay before we try to move any windows om window-created event
    GLib.timeout_add(GLib.PRIORITY_LOW, 300, checkFullScreen.bind(this, win));
  }));
  // Add size-change event handler for windows that are already created. check if the change is of type Maximize or Unmaximize
  // Gnome really need to work on their documentation or googe need to work on their search.
  // Once both of them are done, I will work on my comprehension skills and on finding out it I have ADHD.
  _window_manager_handles.push(global.window_manager.connect('size-change', (_, act, change) => {
    check(act.meta_window, change);
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
  _display_handles.splice(0).forEach(h => global.display.disconnect(h));
}
