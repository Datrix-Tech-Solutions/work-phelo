import 'package:flutter/material.dart';

import 'package:unicons/unicons.dart';

import '../app_theme/misc.dart';
import '../app_theme/padding.dart';
import '../app_theme/text_styles.dart';
import 'my_buttons.dart';

class AppSidePanel extends StatefulWidget {
  final Widget child;
  final double width;
  final String formTitle;
  final VoidCallback onClose;
  final VoidCallback btnOnPressed;
  final VoidCallback secBtnOnPressed;

  const AppSidePanel({
    super.key,
    required this.child,
    required this.formTitle,
    required this.onClose,
    required this.btnOnPressed,
    required this.secBtnOnPressed,
    this.width = 420,
  });

  @override
  State<AppSidePanel> createState() => _AppSidePanelState();
}

class _AppSidePanelState extends State<AppSidePanel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slide;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _slide = Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.easeInOutCubicEmphasized,
      ),
    );

    _fade = Tween<double>(
      begin: 0,
      end: 0.4,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeIn));

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    await _controller.reverse();
    widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Stack(
      children: [
        // ── Scrim ──────────────────────────────────────────────
        FadeTransition(
          opacity: _fade,
          child: GestureDetector(
            onTap: _close,
            child: Container(
              color: Colors.black,
              width: double.infinity,
              height: double.infinity,
            ),
          ),
        ),

        // ── Panel ──────────────────────────────────────────────
        Align(
          alignment: Alignment.centerRight,
          child: SlideTransition(
            position: _slide,
            child: Container(
              width: widget.width,
              height: double.infinity,
              decoration: BoxDecoration(
                color: cs.surface,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(30),
                    blurRadius: 24,
                    offset: const Offset(-4, 0),
                  ),
                ],
              ),
              child: Material(
                child: Navigator(
                  onGenerateRoute: (_) => MaterialPageRoute(
                    builder: (_) => Scaffold(
                      body: Column(
                        children: [
                          // Close button row
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                            child: ListTile(
                              title: Text(
                                widget.formTitle,
                                style: myMainTextStyle(context),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: _close,
                                tooltip: 'Close',
                              ),
                            ),
                          ),
                          myDivider(context),
                          // Content
                          Expanded(child: widget.child),
                          myDivider(context),
                          Padding(
                            padding: myContentPadding,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Flexible(
                                  child: MyOutlinedMenuButton(
                                    onPressed: widget.secBtnOnPressed,
                                    btnText: 'Reset',
                                    btnIcon: UniconsLine.times_circle,
                                    btnAccent: ColorScheme.of(context).error,
                                    isHovered: false,
                                  ),
                                ),
                                Padding(padding: myCardPadding),
                                Flexible(
                                  child: MyOutlinedMenuButton(
                                    onPressed: widget.btnOnPressed,
                                    btnText: 'Submit',
                                    btnIcon: UniconsLine.user_plus,
                                    btnAccent: ColorScheme.of(context).primary,
                                    isHovered: false,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}


class SidePanelController {
  OverlayEntry? _entry;

  void show({
    required BuildContext context,
    required Widget child,
    required String formTitle,
    required VoidCallback onPressed,
    required VoidCallback secOnPressed,
    double width = 420,
  }) {
    _entry = OverlayEntry(
      builder: (_) => AppSidePanel(
        btnOnPressed: onPressed,
        secBtnOnPressed: secOnPressed,
        width: width,
        onClose: close,
        formTitle: formTitle,
        child: child,
      ),
    );
    Overlay.of(context).insert(_entry!);
  }

  void close() {
    _entry?.remove();
    _entry = null;
  }
}
