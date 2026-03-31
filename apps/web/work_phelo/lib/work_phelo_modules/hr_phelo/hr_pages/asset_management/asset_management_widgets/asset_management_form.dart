import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_companies/company_asset_management_functions/company_asset_state.dart';

import '../../../../../work_phelo_components/widgets/form_components/app_text_fields.dart';


class AssetManagementForm extends ConsumerStatefulWidget {
  final String tenantId;
  final Function(bool success, String message) onSubmitCallback;
  final VoidCallback? onSuccess;

  const AssetManagementForm({
    super.key,
    required this.tenantId,
    required this.onSubmitCallback,
    this.onSuccess,
  });

  @override
  ConsumerState<AssetManagementForm> createState() =>
      AssetManagementFormState();
}

class AssetManagementFormState extends ConsumerState<AssetManagementForm> {
  final _formKey = GlobalKey<FormState>();

  // Form field controllers
  late TextEditingController _assetNameController;
  late TextEditingController _serialNumberController;
  String? _selectedAssetType;
  String? _selectedCondition;
  String? _selectedAvailability;
  DateTime? _selectedPurchaseDate;

  bool isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _assetNameController = TextEditingController();
    _serialNumberController = TextEditingController();
  }

  @override
  void dispose() {
    _assetNameController.dispose();
    _serialNumberController.dispose();
    super.dispose();
  }

  // Reset form to initial state
  void resetForm() {
    _formKey.currentState?.reset();
    _assetNameController.clear();
    _serialNumberController.clear();
    setState(() {
      _selectedAssetType = null;
      _selectedCondition = null;
      _selectedAvailability = null;
      _selectedPurchaseDate = null;
    });
  }

  // Handle form submission
  Future<void> submitForm() async {
    if (!_formKey.currentState!.validate()) {
      widget.onSubmitCallback(false, 'Please fill all required fields');
      return;
    }

    if (_selectedPurchaseDate == null) {
      widget.onSubmitCallback(false, 'Please select a purchase date');
      return;
    }

    if (_selectedCondition == null) {
      widget.onSubmitCallback(false, 'Please select asset condition');
      return;
    }

    if (_selectedAvailability == null) {
      widget.onSubmitCallback(false, 'Please select availability status');
      return;
    }
    if (_selectedAssetType == null) {
      widget.onSubmitCallback(false, 'Please select asset type');
      return;
    }

    setState(() => isSubmitting = true);

    try {
      ref
          .read(assetsProvider.notifier)
          .addAsset(
            tenantId: widget.tenantId,
            assetName: _assetNameController.text.trim(),
            assetType: _selectedAssetType!,
            serialNumber: _serialNumberController.text.trim(),
            purchaseDate: _selectedPurchaseDate!,
            assetCondition: _selectedCondition!,
            availability: _selectedAvailability!,
          );

      widget.onSubmitCallback(true, 'Asset added successfully');
      resetForm();
      widget.onSuccess?.call();
    } catch (e) {
      widget.onSubmitCallback(false, 'Error: ${e.toString()}');
    } finally {
      setState(() => isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          MyCustomTextField(
            controller: _assetNameController,
            label: 'Asset Name',
            placeholder: 'eg. Dell Monitor',
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Asset name is required';
              }
              return null;
            },
          ),
          MyDropdownField(
            placeholder: 'Select type',
            items: [
              'Laptop',
              'Monitor',
              'Phone',
              'Printer',
              'Mouse',
              'Keyboard',
              'Desktop',
              'Other',
            ],
            label: 'Asset Type',
            value: _selectedAssetType,
            onChanged: (value) {
              setState(() => _selectedAssetType = value);
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Asset type is required';
              }
              return null;
            },
          ),
          MyCustomTextField(
            controller: _serialNumberController,
            label: 'Serial Number',
            placeholder: 'eg. LTP-001',
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Serial number is required';
              }
              return null;
            },
          ),
          MyDatePicker(
            placeholder: 'dd/mm/yyyy',
            label: 'Purchase Date',
            lastDate: DateTime.now(),
            onDateSelected: (date) {
              setState(() => _selectedPurchaseDate = date);
            },
            validator: (value) {
              if (_selectedPurchaseDate == null) {
                return 'Purchase date is required';
              }
              return null;
            },
          ),
          MyDropdownField(
            placeholder: 'select condition',
            items: ['Excellent', 'Good', 'Fair', 'Poor'],
            label: 'Asset Condition',
            value: _selectedCondition,
            onChanged: (value) {
              setState(() => _selectedCondition = value);
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Asset condition is required';
              }
              return null;
            },
          ),
          MyDropdownField(
            placeholder: 'select availability',
            items: ['Available', 'Assigned', 'Maintenance', 'Retired'],
            label: 'Availability',
            value: _selectedAvailability,
            onChanged: (value) {
              setState(() => _selectedAvailability = value);
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Availability status is required';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}
