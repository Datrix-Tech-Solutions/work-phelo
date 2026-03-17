import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/App_Theme/text_styles.dart';

import '../app_theme/colors.dart';
import '../app_theme/padding.dart';

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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        child: InkWell(
          onTap: isLoading ? null : btnOnPressed,
          borderRadius: BorderRadius.circular(8),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        child: InkWell(
          onTap: isLoading ? null : btnOnPressed,
          borderRadius: BorderRadius.circular(8),
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: InkWell(
        onTap: btnPressed,
        borderRadius: BorderRadius.circular(8),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
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
              backgroundColor: Colors.white,
              side: BorderSide(color: widget.btnAccent, width: 1.4),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
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
    );
  }
}
