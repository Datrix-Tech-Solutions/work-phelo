import { Response } from 'express';
import { HrImportsController } from './hr-imports.controller';
import { EMPLOYEE_IMPORT_TEMPLATE_FILENAME } from './employee-import-columns';
import { HrEmployeeImportsService } from './hr-employee-imports.service';

describe('HrImportsController', () => {
  let controller: HrImportsController;
  const importsService = {
    getEmployeeCsvTemplate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    importsService.getEmployeeCsvTemplate.mockReturnValue(
      'firstName,lastName,email\nAma,Mensah,ama.mensah@example.com\n',
    );
    controller = new HrImportsController(
      importsService as unknown as HrEmployeeImportsService,
    );
  });

  it('returns the employee import CSV template with download headers', () => {
    const setHeader = jest.fn();
    const response = {
      setHeader,
    } as unknown as Response;

    const csv = controller.downloadEmployeeTemplate(response);

    expect(csv).toBe(
      'firstName,lastName,email\nAma,Mensah,ama.mensah@example.com\n',
    );
    expect(importsService.getEmployeeCsvTemplate).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="${EMPLOYEE_IMPORT_TEMPLATE_FILENAME}"`,
    );
  });
});
