import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/padding.dart';

import '../../app_theme/misc.dart';
import '../../app_theme/text_styles.dart';

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

class AppTableWidget extends StatefulWidget {
  final String headerTitle;
  final Widget? headerTrailing;
  final int itemCount;
  final Widget Function(BuildContext, int) itemBuilder;
  final Widget? search;

  final List<String>? columnHeaders;
  final List<int>? columnFlex;
  final int crossAxisCount;
  final double childAspectRatio;

  const AppTableWidget({
    super.key,
    required this.headerTitle,
    this.headerTrailing,
    required this.itemCount,
    required this.itemBuilder,
    this.search,
    this.columnHeaders,
    this.columnFlex,
    this.crossAxisCount = 1,
    this.childAspectRatio = 3.2,
  }) : assert(
          columnHeaders == null ||
              columnFlex == null ||
              columnHeaders.length == columnFlex.length,
          'columnHeaders and columnFlex must have the same length if provided',
        );

  bool get isTableMode => columnHeaders != null && columnHeaders!.isNotEmpty;

  @override
  State<AppTableWidget> createState() => _AppTableWidgetState();
}

class _AppTableWidgetState extends State<AppTableWidget>
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

    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 1, curve: Curves.easeOut)),
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
    final isGrid = widget.crossAxisCount > 1;

    return FadeTransition(
      opacity: _fadeAnimation,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            title: Text(widget.headerTitle, style: myTitleTextStyle(context)),
            trailing: widget.headerTrailing,
          ),

          if (widget.search != null) widget.search!,

          if (widget.isTableMode) ...[
            Padding(
              padding: menuItemPadding,
              child: Row(
                children: List.generate(widget.columnHeaders!.length, (i) {
                  return Expanded(
                    flex: widget.columnFlex?[i] ?? 1,
                    child: Text(
                      widget.columnHeaders![i],
                      style: myMainTextStyle(context).copyWith(
                        fontWeight: FontWeight.w600,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  );
                }),
              ),
            ),
            myDivider(context),
          ],

          // Content area
          Expanded(
            child: SlideTransition(
              position: _slide,
              child: isGrid
                  ? GridView.builder(
                      padding: const EdgeInsets.all(16),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: widget.crossAxisCount,
                        childAspectRatio: widget.childAspectRatio,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                      ),
                      itemCount: widget.itemCount,
                      itemBuilder: widget.itemBuilder,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      itemCount: widget.itemCount,
                      separatorBuilder: (context, index) => myDivider(context),
                      itemBuilder: widget.itemBuilder,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}