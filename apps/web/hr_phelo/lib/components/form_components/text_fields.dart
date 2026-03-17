import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:unicons/unicons.dart';

import '../app_theme/colors.dart';
import '../app_theme/padding.dart';
import '../app_theme/text_styles.dart';

class MyCustomTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String label;
  final String placeholder;
  final bool enabled;
  final String? prefixText;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChange;
  final TextInputType? keyType;
  final TextInputAction? textAction;

  const MyCustomTextField({
    super.key,
    required this.label,
    required this.placeholder,
    this.controller,
    this.enabled = true,
    this.validator,
    this.onChange,
    this.keyType,
    this.textAction,
    this.prefixText,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(label, style: myMainTextStyle(context)),
          ),
          TextFormField(
            controller: controller,
            validator: validator,
            enabled: enabled,
            textInputAction: textAction,
            keyboardType: keyType,
            
            style: myMainTextStyle(context),
            decoration: InputDecoration(
              prefixText: prefixText,
              hintText: placeholder,
              hintStyle: myTextFieldStyle(context),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: ColorScheme.of(context).outline.withAlpha(50),
                  width: 1,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: myMainColor.withAlpha(70),
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.red, width: 1),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.redAccent, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// password fields
class MyPasswordField extends StatefulWidget {
  final TextEditingController? controller;
  final String label;
  final String placeholder;
  final bool obscureText;
  final bool enabled;
  final ValueChanged<String>? onChange;
  final String? Function(String?)? validator;
  final TextInputType? keyType;
  final TextInputAction? textAction;
  const MyPasswordField({
    super.key,
    this.controller,
    required this.label,
    required this.placeholder,
    this.obscureText = true,
    this.enabled = true,
    this.validator,
    this.onChange,
    this.keyType,
    this.textAction,
  });

  @override
  State<MyPasswordField> createState() => _MyPasswordFieldState();
}

class _MyPasswordFieldState extends State<MyPasswordField> {
  late bool _obscure;

  @override
  void initState() {
    super.initState();
    _obscure = widget.obscureText;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(widget.label, style: myMainTextStyle(context)),
          ),
          TextFormField(
            controller: widget.controller,
            validator: widget.validator,
            enabled: widget.enabled,
            textInputAction: widget.textAction,
            keyboardType: widget.keyType,
            obscureText: _obscure,
            obscuringCharacter: '*',
            onChanged: widget.onChange,
            style: myMainTextStyle(context),
            decoration: InputDecoration(
              hintText: widget.placeholder,
              hintStyle: myTextFieldStyle(context),
              suffixIcon: widget.obscureText
                  ? IconButton(
                      hoverColor: Colors.transparent,
                      highlightColor: Colors.transparent,
                      icon: Icon(
                        _obscure ? UniconsLine.eye_slash : UniconsLine.eye,
                        color: ColorScheme.of(context).outline,
                        size: 20,
                      ),
                      onPressed: () {
                        setState(() => _obscure = !_obscure);
                      },
                    )
                  : null,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: ColorScheme.of(context).outline.withAlpha(50),
                  width: 1,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: myMainColor.withAlpha(70),
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.red, width: 1),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(15),
                borderSide: BorderSide(color: Colors.redAccent, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// OTP text boxes
class OtpTextBoxes extends StatefulWidget {
  final int length;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onCompleted;

  const OtpTextBoxes({
    super.key,
    this.length = 6,
    this.controller,
    this.onChanged,
    this.onCompleted,
  });

  @override
  State<OtpTextBoxes> createState() => _OtpTextBoxesState();
}

class _OtpTextBoxesState extends State<OtpTextBoxes> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _focusNodes = List.generate(widget.length, (_) => FocusNode());

    if (widget.controller != null) {
      for (final ctrl in _controllers) {
        ctrl.addListener(_syncToParent);
      }
    }
  }

  void _syncToParent() {
    final otp = _getCurrentOtp();
    widget.controller?.text = otp;
    widget.onChanged?.call(otp);
  }

  String _getCurrentOtp() {
    return _controllers.map((c) => c.text).join();
  }

  void _onFieldChanged(String value, int index) {
    if (value.length > 1) {
      _handlePaste(value, index);
      return;
    }

    final isFilled = value.isNotEmpty;

    if (isFilled) {
      if (index < widget.length - 1) {
        _focusNodes[index + 1].requestFocus();
      }
    } else {
      if (index > 0) {
        _focusNodes[index - 1].requestFocus();
        _controllers[index - 1].selection = TextSelection(
          baseOffset: 0,
          extentOffset: _controllers[index - 1].text.length,
        );
      }
    }

    _notifyChanges();
  }

  void _handlePaste(String paste, int startIndex) {
    final digitsOnly = paste.replaceAll(RegExp(r'[^0-9]'), '');
    if (digitsOnly.isEmpty) return;

    var pos = startIndex;
    for (final digit in digitsOnly.split('')) {
      if (pos >= widget.length) break;
      _controllers[pos].text = digit;
      pos++;
    }

    final nextFocusIndex = pos < widget.length ? pos : widget.length - 1;
    _focusNodes[nextFocusIndex].requestFocus();

    _notifyChanges();
  }

  void _notifyChanges() {
    final otp = _getCurrentOtp();

    widget.controller?.text = otp;
    widget.onChanged?.call(otp);

    if (otp.length == widget.length) {
      widget.onCompleted?.call(otp);
    }
  }

  @override
  void dispose() {
    for (final ctrl in _controllers) {
      ctrl.removeListener(_syncToParent);
      ctrl.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(widget.length, (index) {
        return Container(
          width: 56,
          margin: const EdgeInsets.symmetric(horizontal: 6),
          child: TextField(
            controller: _controllers[index],
            focusNode: _focusNodes[index],
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 1,
            autofocus: index == 0,
            textInputAction: TextInputAction.next,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(1),
            ],
            decoration: InputDecoration(
              counterText: '',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: ColorScheme.of(context).outline.withAlpha(50),
                  width: 1,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: myMainColor.withAlpha(70),
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.red, width: 1),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.redAccent, width: 2),
              ),
            ),
            onChanged: (value) => _onFieldChanged(value, index),
          ),
        );
      }),
    );
  }
}

class CustomSearchField extends StatelessWidget {
  final TextEditingController? controller;
  final String hinttext;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final String? Function(String?)? validator;
  final VoidCallback? onTap;

  const CustomSearchField({
    super.key,
    this.controller,
    required this.hinttext,
    this.enabled = true,
    this.validator,
    this.onChanged,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: myContentPadding,
      child: TextFormField(
        controller: controller,
        validator: validator,
        onTap: onTap,
        enabled: enabled,
        onChanged: onChanged,
        style: myMainTextStyle(context),
        decoration: InputDecoration(
          hintText: hinttext,
          hintStyle: myMainTextStyle(
            context,
          ).copyWith(color: ColorScheme.of(context).outline),
          prefixIcon: Icon(
            UniconsLine.search_alt,
            color: ColorScheme.of(context).outline,
          ),
          contentPadding: EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(
              color: ColorScheme.of(context).outline,
              width: 1,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: myMainColor, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: myMainColor, width: 1),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: myMainColor, width: 2),
          ),
        ),
      ),
    );
  }
}
