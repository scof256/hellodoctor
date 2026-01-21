import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MedicalSidebar from '@/app/(dashboard)/doctor/patients/[connectionId]/intake/MedicalSidebar';

describe('MedicalSidebar Component', () => {
  const mockMedicalData = {
    chiefComplaint: 'Severe headache',
    reviewOfSystems: ['Headache', 'Nausea', 'Photophobia'],
    medications: ['Ibuprofen 400mg', 'Paracetamol 500mg'],
    allergies: ['Penicillin', 'Sulfa drugs'],
    clinicalHandover: {
      situation: 'Patient presents with severe headache',
      background: 'No prior history of migraines',
      assessment: 'Possible migraine or tension headache',
      recommendation: 'Prescribe pain relief and monitor',
    },
    ucgRecommendations: 'Follow UCG guidelines for headache management',
  };

  const defaultProps = {
    isOpen: true,
    onToggle: vi.fn(),
    activeTab: 'intake-data' as const,
    onTabChange: vi.fn(),
    completeness: 75,
    medicalData: mockMedicalData,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout and Structure', () => {
    it('should render with fixed width on desktop (400px)', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} />);
      const sidebar = container.firstChild as HTMLElement;
      
      expect(sidebar).toHaveClass('md:w-[400px]');
    });

    it('should render as slide-out drawer on mobile', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} />);
      const sidebar = container.firstChild as HTMLElement;
      
      expect(sidebar).toHaveClass('fixed');
      expect(sidebar).toHaveClass('md:relative');
    });

    it('should show sidebar when isOpen is true', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} isOpen={true} />);
      const sidebar = container.firstChild as HTMLElement;
      
      expect(sidebar).toHaveClass('translate-x-0');
    });

    it('should hide sidebar on mobile when isOpen is false', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} isOpen={false} />);
      const sidebar = container.firstChild as HTMLElement;
      
      expect(sidebar).toHaveClass('translate-x-full');
    });

    it('should always show sidebar on desktop regardless of isOpen', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} isOpen={false} />);
      const sidebar = container.firstChild as HTMLElement;
      
      // Desktop override: md:translate-x-0
      expect(sidebar).toHaveClass('md:translate-x-0');
    });
  });

  describe('Tab Navigation', () => {
    it('should render both tab buttons', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      expect(screen.getByText('Intake Data')).toBeInTheDocument();
      expect(screen.getByText('Dr. Handover')).toBeInTheDocument();
    });

    it('should highlight active tab (Intake Data)', () => {
      render(<MedicalSidebar {...defaultProps} activeTab="intake-data" />);
      
      const intakeTab = screen.getByText('Intake Data').closest('button');
      expect(intakeTab).toHaveClass('border-purple-600', 'text-purple-600', 'bg-purple-50');
    });

    it('should highlight active tab (Dr. Handover)', () => {
      render(<MedicalSidebar {...defaultProps} activeTab="handover" />);
      
      const handoverTab = screen.getByText('Dr. Handover').closest('button');
      expect(handoverTab).toHaveClass('border-purple-600', 'text-purple-600', 'bg-purple-50');
    });

    it('should call onTabChange when clicking Intake Data tab', () => {
      const onTabChange = vi.fn();
      render(<MedicalSidebar {...defaultProps} activeTab="handover" onTabChange={onTabChange} />);
      
      fireEvent.click(screen.getByText('Intake Data'));
      
      expect(onTabChange).toHaveBeenCalledWith('intake-data');
    });

    it('should call onTabChange when clicking Dr. Handover tab', () => {
      const onTabChange = vi.fn();
      render(<MedicalSidebar {...defaultProps} activeTab="intake-data" onTabChange={onTabChange} />);
      
      fireEvent.click(screen.getByText('Dr. Handover'));
      
      expect(onTabChange).toHaveBeenCalledWith('handover');
    });

    it('should have smooth transitions on tab buttons', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      const intakeTab = screen.getByText('Intake Data').closest('button');
      expect(intakeTab).toHaveClass('transition-all', 'duration-200', 'ease-in-out');
    });
  });

  describe('Mobile Toggle Button', () => {
    it('should render close button on mobile', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close sidebar');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onToggle when clicking close button', () => {
      const onToggle = vi.fn();
      render(<MedicalSidebar {...defaultProps} onToggle={onToggle} />);
      
      fireEvent.click(screen.getByLabelText('Close sidebar'));
      
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Intake Data Tab Content', () => {
    it('should display progress indicator with correct percentage', () => {
      render(<MedicalSidebar {...defaultProps} completeness={75} />);
      
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Intake Progress')).toBeInTheDocument();
    });

    it('should display chief complaint when present', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      expect(screen.getByText('Chief Complaint')).toBeInTheDocument();
      expect(screen.getByText('Severe headache')).toBeInTheDocument();
    });

    it('should display review of systems when present', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      expect(screen.getByText('Review of Systems')).toBeInTheDocument();
      expect(screen.getByText('Headache')).toBeInTheDocument();
      expect(screen.getByText('Nausea')).toBeInTheDocument();
      expect(screen.getByText('Photophobia')).toBeInTheDocument();
    });

    it('should display medications when present', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofen 400mg')).toBeInTheDocument();
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    });

    it('should display allergies when present', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      expect(screen.getByText('Allergies')).toBeInTheDocument();
      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Sulfa drugs')).toBeInTheDocument();
    });

    it('should not display sections when data is missing', () => {
      render(<MedicalSidebar {...defaultProps} medicalData={{}} />);
      
      expect(screen.queryByText('Chief Complaint')).not.toBeInTheDocument();
      expect(screen.queryByText('Review of Systems')).not.toBeInTheDocument();
      expect(screen.queryByText('Medications')).not.toBeInTheDocument();
      expect(screen.queryByText('Allergies')).not.toBeInTheDocument();
    });
  });

  describe('Dr. Handover Tab Content', () => {
    beforeEach(() => {
      // Switch to handover tab for these tests
      defaultProps.activeTab = 'handover';
    });

    afterEach(() => {
      // Reset to default
      defaultProps.activeTab = 'intake-data';
    });

    it('should display SBAR sections when clinical handover is present', () => {
      render(<MedicalSidebar {...defaultProps} activeTab="handover" />);
      
      expect(screen.getByText('Clinical Handover (SBAR)')).toBeInTheDocument();
      expect(screen.getByText('Situation')).toBeInTheDocument();
      expect(screen.getByText('Background')).toBeInTheDocument();
      expect(screen.getByText('Assessment')).toBeInTheDocument();
      expect(screen.getByText('Recommendation')).toBeInTheDocument();
    });

    it('should display SBAR content correctly', () => {
      render(<MedicalSidebar {...defaultProps} activeTab="handover" />);
      
      expect(screen.getByText('Patient presents with severe headache')).toBeInTheDocument();
      expect(screen.getByText('No prior history of migraines')).toBeInTheDocument();
      expect(screen.getByText('Possible migraine or tension headache')).toBeInTheDocument();
      expect(screen.getByText('Prescribe pain relief and monitor')).toBeInTheDocument();
    });

    it('should display placeholder when clinical handover is not present', () => {
      const dataWithoutHandover = { ...mockMedicalData, clinicalHandover: null };
      render(<MedicalSidebar {...defaultProps} activeTab="handover" medicalData={dataWithoutHandover} />);
      
      expect(screen.getByText('Clinical handover will be generated as the intake progresses.')).toBeInTheDocument();
    });

    it('should display UCG recommendations when present', () => {
      render(<MedicalSidebar {...defaultProps} activeTab="handover" />);
      
      expect(screen.getByText('Uganda Clinical Guidelines')).toBeInTheDocument();
      expect(screen.getByText('Follow UCG guidelines for headache management')).toBeInTheDocument();
    });

    it('should not display UCG recommendations when not present', () => {
      const dataWithoutUCG = { ...mockMedicalData, ucgRecommendations: null };
      render(<MedicalSidebar {...defaultProps} activeTab="handover" medicalData={dataWithoutUCG} />);
      
      expect(screen.queryByText('Uganda Clinical Guidelines')).not.toBeInTheDocument();
    });
  });

  describe('Smooth Transitions', () => {
    it('should have transition classes on sidebar container', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} />);
      const sidebar = container.firstChild as HTMLElement;
      
      expect(sidebar).toHaveClass('transition-transform', 'duration-300', 'ease-in-out');
    });

    it('should have transition classes on tab content', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} />);
      
      // Find the content divs with transition classes
      const contentDivs = container.querySelectorAll('.transition-opacity');
      expect(contentDivs.length).toBeGreaterThan(0);
    });

    it('should have transition classes on SBAR sections', () => {
      render(<MedicalSidebar {...defaultProps} activeTab="handover" />);
      
      const sbarSections = screen.getByText('Situation').closest('div');
      expect(sbarSections).toHaveClass('transition-all', 'duration-200');
    });
  });

  describe('Responsive Behavior', () => {
    it('should have responsive width classes', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} />);
      const sidebar = container.firstChild as HTMLElement;
      
      expect(sidebar).toHaveClass('w-full');
      expect(sidebar).toHaveClass('sm:w-96');
      expect(sidebar).toHaveClass('md:w-[400px]');
    });

    it('should have mobile-specific header', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      const mobileHeader = screen.getByText('Medical Data');
      expect(mobileHeader).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on close button', () => {
      render(<MedicalSidebar {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close sidebar');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have semantic HTML structure', () => {
      const { container } = render(<MedicalSidebar {...defaultProps} />);
      
      // Check for proper heading elements
      const headings = container.querySelectorAll('h2, h3');
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});
