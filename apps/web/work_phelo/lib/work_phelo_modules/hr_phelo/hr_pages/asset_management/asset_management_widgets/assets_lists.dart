import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_asset_management_functions/company_asset_model.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_asset_management_functions/company_asset_state.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';

import '../../../../../work_phelo_components/theme/app_padding.dart';
import 'asset_card.dart';

class AssetsLists extends ConsumerStatefulWidget {
  final AppUserModel currentUser;
  const AssetsLists({super.key,required this.currentUser});

  @override
  ConsumerState<AssetsLists> createState() => _AssetsListsState();
}

class _AssetsListsState extends ConsumerState<AssetsLists> {
  @override
  Widget build(BuildContext context) {
    final allAssets = ref.watch(tenantFilteredAssetsProvider(widget.currentUser.tenantSlug));

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossCount = constraints.maxWidth >= 1200
            ? 3
            : constraints.maxWidth >= 900
            ? 2
            : constraints.maxWidth >= 600
            ? 3
            : 2;

        return Padding(
          padding: myContentPadding,
          child: allAssets.isEmpty
              ? _buildEmptyState()
              : GridView.builder(
                  padding: const EdgeInsets.only(top: 8),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossCount,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    mainAxisExtent: 270,
                  ),
                  itemCount: allAssets.length,
                  itemBuilder: (context, index) {
                    final asset = allAssets[index];
                    return AssetCard(
                      asset: asset,
                      onEdit: () => _showEditDialog(asset),
                      onAssign: () => _showAssignDialog(asset),
                      onDelete: () => _confirmDelete(asset),
                    );
                  },
                ),
        );
      },
    );
  }

  // Empty state when no assets
  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inventory_2_outlined,
            size: 80,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            'No assets yet',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            'Add your first asset to get started',
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }

  // Example action handlers - connect these to your logic
  void _showEditDialog(AssetModel asset) {
    // TODO: Open edit bottom sheet or dialog
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('Edit ${asset.assetName}')));
  }

  void _showAssignDialog(AssetModel asset) {
    // TODO: Open assign to tenant/user dialog
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('Assign ${asset.assetName}')));
  }

  void _confirmDelete(AssetModel asset) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Asset'),
        content: Text('Are you sure you want to delete ${asset.assetName}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              ref.read(assetsProvider.notifier).deleteAsset(asset.id);
              Navigator.pop(context);
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(const SnackBar(content: Text('Asset deleted')));
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
