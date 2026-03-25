import 'package:flutter/material.dart';

import '../app_theme/colors.dart';
import '../app_theme/misc.dart';
import '../app_theme/padding.dart';
import '../app_theme/text_styles.dart';

class MyButton extends StatelessWidget {
  final String btnText;
  final String? loadingText;
  final bool isLoading;
  final Color? btnColor;
  final VoidCallback btnOnPressed;

  const MyButton({
    super.key,
    required this.btnText,
    required this.btnOnPressed,
    this.loadingText,
    this.isLoading = false,
    this.btnColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Card(
        color: widgetColor(context),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(appRadius)),
        child: InkWell(
          onTap: isLoading ? null : btnOnPressed,
          borderRadius: BorderRadius.circular(appRadius),
          child: SizedBox(
            height: 50,
            child: Center(
              child: isLoading
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          loadingText ?? btnText,
                          style: myDisplayTextStyle(context).copyWith(
                            color: ColorScheme.of(context).onInverseSurface,
                          ),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    )
                  : Text(
                      btnText,
                      textAlign: TextAlign.center,
                      style: myDisplayTextStyle(context).copyWith(
                        color: ColorScheme.of(context).onInverseSurface,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Color widgetColor(BuildContext context) {
    return btnColor ?? myMainColor;
  }
}

class MySecButton extends StatelessWidget {
  final String btnText;
  final String? loadingText;
  final bool isLoading;
  final VoidCallback btnOnPressed;

  const MySecButton({
    super.key,
    required this.btnText,
    required this.btnOnPressed,
    this.loadingText,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Card(
        elevation: 0,
        color: ColorScheme.of(context).surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(appRadius)),
        child: InkWell(
          onTap: isLoading ? null : btnOnPressed,
          borderRadius: BorderRadius.circular(appRadius),
          child: SizedBox(
            height: 50,
            child: Center(
              child: isLoading
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          loadingText ?? btnText,
                          style: myDisplayTextStyle(
                            context,
                          ).copyWith(color: ColorScheme.of(context).onSurface),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: ColorScheme.of(context).onSurface,
                          ),
                        ),
                      ],
                    )
                  : Text(
                      btnText,
                      textAlign: TextAlign.center,
                      style: myDisplayTextStyle(
                        context,
                      ).copyWith(color: ColorScheme.of(context).onSurface),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class WidgetButton extends StatelessWidget {
  final String btnText;
  final IconData? btnIcon;
  final VoidCallback btnPressed;
  const WidgetButton({
    super.key,
    this.btnIcon,
    required this.btnText,
    required this.btnPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.grey.withAlpha(20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(appRadius)),
      child: InkWell(
        onTap: btnPressed,
        borderRadius: BorderRadius.circular(appRadius),
        child: SizedBox(
          height: 50,
          child: Padding(
            padding: menuItemPadding,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(btnIcon),
                Text(btnText, style: myMainTextStyle(context)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MyTextButton extends StatelessWidget {
  final String txtBtnText;
  final VoidCallback txtBtnOnPressed;
  const MyTextButton({
    super.key,
    required this.txtBtnText,
    required this.txtBtnOnPressed,
  });

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: txtBtnOnPressed,
      style: TextButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(appRadius)),
        splashFactory: NoSplash.splashFactory,
      ),
      child: Text(txtBtnText, style: myMainTextStyle(context)),
    );
  }
}

class MyOutlinedButton extends StatefulWidget {
  const MyOutlinedButton({
    super.key,
    required this.onPressed,
    required this.btnText,
    required this.btnIcon,
    required this.btnAccent,
    required this.isHovered,
  });

  final VoidCallback onPressed;
  final String btnText;
  final IconData btnIcon;
  final Color btnAccent;
  final bool isHovered;

  @override
  State<MyOutlinedButton> createState() => _MyOutlinedButtonState();
}

class _MyOutlinedButtonState extends State<MyOutlinedButton> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onAccent = theme.colorScheme.onPrimary;

    return Padding(
      padding: formWidgetPadding,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(appRadius),
          boxShadow: widget.isHovered
              ? [
                  BoxShadow(
                    color: widget.btnAccent.withAlpha(20),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.all(5.0),
          child: OutlinedButton.icon(
            icon: Icon(widget.btnIcon, size: 20),
            label: Text(
              widget.btnText,
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            onPressed: widget.onPressed,
            style:
                OutlinedButton.styleFrom(
                  foregroundColor: widget.btnAccent,
                  backgroundColor: Colors.white,
                  side: BorderSide(color: widget.btnAccent, width: 1.4),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 28,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(appRadius),
                  ),
                  elevation: 0,
                  minimumSize: const Size(140, 52),
                ).copyWith(
                  backgroundColor: WidgetStateProperty.resolveWith((states) {
                    return states.contains(WidgetState.hovered)
                        ? widget.btnAccent
                        : Colors.white;
                  }),
                  foregroundColor: WidgetStateProperty.resolveWith((states) {
                    return states.contains(WidgetState.hovered)
                        ? onAccent
                        : widget.btnAccent;
                  }),
                  side: WidgetStateProperty.resolveWith((states) {
                    return BorderSide(
                      color: widget.btnAccent,
                      width: states.contains(WidgetState.hovered) ? 1.8 : 1.4,
                    );
                  }),
                  overlayColor: WidgetStateProperty.all(
                    widget.btnAccent.withAlpha(18),
                  ),
                  elevation: WidgetStateProperty.resolveWith((states) {
                    return states.contains(WidgetState.hovered) ? 2 : 0;
                  }),
                ),
          ),
        ),
      ),
    );
  }
}

class MyOutlinedMenuButton extends StatefulWidget {
  const MyOutlinedMenuButton({
    super.key,
    required this.onPressed,
    required this.btnText,
    required this.btnIcon,
    required this.btnAccent,
    required this.isHovered,
  });

  final VoidCallback onPressed;
  final String btnText;
  final IconData btnIcon;
  final Color btnAccent;
  final bool isHovered;

  @override
  State<MyOutlinedMenuButton> createState() => _MyOutlinedMenuButtonState();
}

class _MyOutlinedMenuButtonState extends State<MyOutlinedMenuButton> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onAccent = theme.colorScheme.onPrimary;
    final cs = ColorScheme.of(context);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(appRadius),
        boxShadow: widget.isHovered
            ? [
                BoxShadow(
                  color: widget.btnAccent.withAlpha(20),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: OutlinedButton.icon(
        icon: Icon(widget.btnIcon, size: 20),
        label: Text(
          widget.btnText,
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        onPressed: widget.onPressed,
        style:
            OutlinedButton.styleFrom(
              foregroundColor: widget.btnAccent,
              backgroundColor: cs.outline,
              side: BorderSide(color: cs.outline, width: 1.5),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(appRadius),
              ),
              elevation: 0,
              minimumSize: const Size(140, 40),
            ).copyWith(
              //button color
              backgroundColor: WidgetStateProperty.resolveWith((states) {
                return states.contains(WidgetState.hovered)
                    ? widget.btnAccent
                    : Colors.white;
              }),
              //text color
              foregroundColor: WidgetStateProperty.resolveWith((states) {
                return states.contains(WidgetState.hovered)
                    ? onAccent
                    : widget.btnAccent;
              }),
              side: WidgetStateProperty.resolveWith((states) {
                return BorderSide(
                  color: cs.outline,
                  width: states.contains(WidgetState.hovered) ? 1.8 : 1.4,
                );
              }),
              overlayColor: WidgetStateProperty.all(
                widget.btnAccent.withAlpha(18),
              ),
              elevation: WidgetStateProperty.resolveWith((states) {
                return states.contains(WidgetState.hovered) ? 2 : 0;
              }),
            ),
      ),
    );
  }
}
