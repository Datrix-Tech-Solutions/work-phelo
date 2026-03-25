import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:unicons/unicons.dart';
import 'package:intl/intl.dart';

import '../../Components/app_theme/colors.dart';
import '../app_theme/misc.dart';
import '../app_theme/padding.dart';
import '../app_theme/text_styles.dart';

const fieldspace = EdgeInsets.only(top: 5, bottom: 5);

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
  final List<TextInputFormatter>? inputType;
  final int? textLenght;
  final int? maxLines;

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
    this.inputType,
    this.textLenght,
    this.maxLines,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: fieldspace,
            child: Text(label, style: myMainTextStyle(context)),
          ),
          TextFormField(
            controller: controller,
            validator: validator,
            enabled: enabled,
            textInputAction: textAction,
            keyboardType: keyType,
            inputFormatters: inputType,
            maxLength: textLenght,
            maxLines: maxLines,
            style: myMainTextStyle(context),
            decoration: appTextFieldDecoration(
              context,
              hintText: placeholder,
              prefixText: prefixText,
              hintStyle: myTextFieldStyle(context),
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
  late bool _obscureText;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.obscureText;
  }

  void _toggleObscure() {
    setState(() {
      _obscureText = !_obscureText;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: fieldspace,
            child: Text(widget.label, style: myMainTextStyle(context)),
          ),
          TextFormField(
            controller: widget.controller,
            validator: widget.validator,
            enabled: widget.enabled,
            textInputAction: widget.textAction,
            keyboardType: widget.keyType,
            obscureText: _obscureText,
            obscuringCharacter: '*',
            onChanged: widget.onChange,
            style: myMainTextStyle(context),
            decoration: appTextFieldDecoration(
              context,
              hintText: widget.placeholder,
              hintStyle: myTextFieldStyle(context),
              obscureText: _obscureText,
              onToggleVisibility: _toggleObscure,
              showVisibilityToggle: widget.obscureText,
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
            decoration: appTextFieldDecoration(
              context,
              hintText: '',
              prefixText: '',
              hintStyle: myTextFieldStyle(context),
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
      padding: formWidgetPadding,
      child: TextFormField(
        controller: controller,
        validator: validator,
        onTap: onTap,
        enabled: enabled,
        onChanged: onChanged,
        style: myMainTextStyle(context),
        decoration: appTextFieldDecoration(
          context,
          hintText: hinttext,
          prefixText: '',
          showPrefixIcon: true,
          prefixIconData: UniconsLine.search_alt,
          prefixIconColor: ColorScheme.of(context).outline,
          hintStyle: myTextFieldStyle(context),
        ),
      ),
    );
  }
}

class MyDropdownField extends StatelessWidget {
  final TextEditingController? controller;
  final String? Function(String?)? validator;
  final String? initialValue;
  final String? value;
  final String placeholder;
  final String? label;
  final List<String> items;
  final void Function(String?)? onChanged;
  final IconData? prefixIcon;
  final bool enabled;

  const MyDropdownField({
    super.key,
    this.controller,
    this.validator,
    this.initialValue,
    this.value,
    required this.placeholder,
    this.label,
    required this.items,
    this.onChanged,
    this.prefixIcon,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    String? effectiveValue =
        value ?? ((controller?.text.isEmpty ?? true) ? null : controller!.text);

    if (effectiveValue != null && !items.contains(effectiveValue)) {
      effectiveValue = null;
    }

    return Padding(
      padding: formWidgetPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label != null)
            Padding(
              padding: fieldspace,
              child: Text(label ?? '', style: myMainTextStyle(context)),
            ),
          DropdownButtonFormField<String>(
            initialValue: effectiveValue,
            validator: validator,
            isExpanded: true,
            alignment: Alignment.centerLeft,
            elevation: 4,
            borderRadius: BorderRadius.circular(appRadius),
            dropdownColor: cs.surfaceContainer,
            style: myTextFieldStyle(context),
            icon: Icon(
              UniconsLine.angle_down,
              color: enabled ? cs.onSurfaceVariant : cs.onSurface.withAlpha(38),
              size: 24,
            ),
            iconSize: 24,
            decoration: appTextFieldDecoration(
              context,
              hintText: placeholder,
              prefixText: '',
              hintStyle: myTextFieldStyle(context),
            ),
            items: items.map((item) {
              return DropdownMenuItem<String>(
                value: item,
                child: Text(
                  item,
                  style: myTextFieldStyle(context).copyWith(
                    color: cs.onSurface,
                    fontWeight: effectiveValue == item ? FontWeight.w500 : null,
                  ),
                ),
              );
            }).toList(),
            onChanged: enabled
                ? (val) {
                    if (controller != null) {
                      controller!.text = val ?? '';
                    }
                    onChanged?.call(val);
                  }
                : null,
          ),
        ],
      ),
    );
  }
}

class MyDatePicker extends StatefulWidget {
  final TextEditingController? controller;
  final String placeholder;
  final String label;
  final String? value;
  final DateTime? initialDate;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final String? Function(String?)? validator;
  final ValueChanged<DateTime?>? onDateSelected;
  final bool enabled;
  final IconData? prefixIcon;
  final String dateFormat;

  const MyDatePicker({
    super.key,
    this.controller,
    required this.placeholder,
    required this.label,
    this.value,
    this.initialDate,
    this.firstDate,
    this.lastDate,
    this.validator,
    this.onDateSelected,
    this.enabled = true,
    this.prefixIcon,
    this.dateFormat = 'dd/MM/yyyy',
  });

  @override
  State<MyDatePicker> createState() => _MyDatePickerState();
}

class _MyDatePickerState extends State<MyDatePicker> {
  late TextEditingController _internalController;
  DateTime? _selectedDate;

  @override
  void initState() {
    super.initState();
    _internalController = widget.controller ?? TextEditingController();
    _selectedDate = widget.initialDate;
    if (_selectedDate != null) {
      _internalController.text = DateFormat(
        widget.dateFormat,
      ).format(_selectedDate!);
    }
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _internalController.dispose();
    }
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    if (!widget.enabled) return;

    final DateTime initial =
        _selectedDate ?? widget.initialDate ?? DateTime.now();

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: widget.firstDate ?? DateTime(1900),
      lastDate: widget.lastDate ?? DateTime(2100),
      useRootNavigator: false,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
              primary: myMainColor,
              onPrimary: Colors.white,
              surface: Theme.of(context).colorScheme.surfaceContainerLowest,
              onSurface: Theme.of(context).colorScheme.onSurface,
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(foregroundColor: myMainColor),
            ),
            datePickerTheme: DatePickerThemeData(
              backgroundColor: Theme.of(
                context,
              ).colorScheme.surfaceContainerLowest,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(appRadius),
              ),
            ),
          ),
          child: child!,
        );
      },
    );

    if (!mounted) return;
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
        _internalController.text = DateFormat(widget.dateFormat).format(picked);
      });
      widget.onDateSelected?.call(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: formWidgetPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: fieldspace,
            child: Text(widget.label, style: myMainTextStyle(context)),
          ),
          TextFormField(
            controller: _internalController,
            readOnly: true,
            enabled: widget.enabled,
            validator: widget.validator,
            onTap: () => _selectDate(context),
            style: myMainTextStyle(context),
            decoration: appTextFieldDecoration(
              context,
              hintText: widget.placeholder,
              prefixText: '',
              hintStyle: myTextFieldStyle(context),
            ),
          ),
        ],
      ),
    );
  }
}

class MyCheckBox extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  final Color? accentColor;

  const MyCheckBox({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = accentColor ?? cs.primary;

    return GestureDetector(
      onTap: () => onChanged(!value),
      behavior: HitTestBehavior.opaque,
      child: Card(
        elevation: 0,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 10.0, top: 5, bottom: 5),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOutCubic,
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: value ? accent : Colors.transparent,
                  border: Border.all(
                    color: value ? accent : cs.outline,
                    width: 1.5,
                  ),
                  borderRadius: BorderRadius.circular(appRadius),
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: value
                      ? Icon(
                          UniconsLine.check_circle,
                          key: const ValueKey(true),
                          size: 14,
                          color: cs.onPrimary,
                        )
                      : const SizedBox.shrink(key: ValueKey(false)),
                ),
              ),
            ),
            Flexible(
              child: ListTile(
                title: Text(label, style: myMainTextStyle(context)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
