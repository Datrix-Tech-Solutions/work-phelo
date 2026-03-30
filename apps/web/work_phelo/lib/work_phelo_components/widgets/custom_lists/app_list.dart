import 'package:flutter/material.dart';

import '../../theme/app_text_theme.dart';
import '../../theme/miscellaneouse.dart';

class AppListWidget extends StatefulWidget {
  final String headerTitle;
  final String? headerTrailingText;
  final int itemCount;
  final Widget Function(BuildContext, int) itemBuilder;
  final Widget? search;

  const AppListWidget({
    super.key,
    required this.headerTitle,
    this.headerTrailingText,
    required this.itemCount,
    required this.itemBuilder,
    this.search,
  });

  @override
  State<AppListWidget> createState() => _AppListWidgetState();
}

class _AppListWidgetState extends State<AppListWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );

    _slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.0, 1, curve: Curves.easeOut),
          ),
        );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Column(
        children: [
          if (widget.search != null) widget.search!,
          ListTile(
            title: Text(widget.headerTitle, style: myTitleTextStyle(context)),
            trailing: widget.headerTrailingText != null
                ? Text(widget.headerTrailingText!)
                : null,
          ),
          myDivider(context),
          Expanded(
            child: SlideTransition(
              position: _slide,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: widget.itemCount,
                itemBuilder: widget.itemBuilder,
              ),
            ),
          ),
        ],
      ),
    );
  }
}