# MaximizeToWorkspace
Fork of https://github.com/rliang/gnome-shell-extension-maximize-to-workspace with history support
Took elements from https://github.com/satran/fullscreenworkspace-satran.in

To install run:
```
git clone https://github.com/raonetwo/MaximizeToWorkspace.git ~/.local/share/gnome-shell/extensions/maximize-to-workspace@raonetwo.github.com
gnome-extensions enable maximize-to-workspace@raonetwo.github.com
```

Then press Alt + F2 and in the dialogue box press "r" (no quotes) and enter  to refresh the gnome session and verify that the extension has been enabled

This extension is best utilized with multi finger gestures are enabled e.g. using Fusuma

This has been tested on Ubuntu 19.10 on gnome version 3.34.2, contribution are accepted for following:
1. Test it out other gnome shell versions and update metadata.json
2. Currently the windows that start maximized (when you close maximized window and the window position is remembered) are not auto moved, you will have to unmaximize and maximize again to fix that. 
I tried implementing it nut was facing this issue https://www.reddit.com/r/Ubuntu/comments/fuvsuh/new_maximized_window_are_moved_to_new_workspace/ refer the first commit.
Any contributions to fix this are appreciated.
3. Currently a few things are set as default like start with second workspace, no default workspace if run out of workspaces in static workspace mode, etc. These need to be exposed and set based on user preference.

