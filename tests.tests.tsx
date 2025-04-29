import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { MemoryRouter, NavigateFunction, Location, Params } from 'react-router-dom';
import * as router from 'react-router-dom';
import { ServicesView } from '../ServicesPage';
import { withRouter } from '../../../../utils/withRouter';
import { withStyles } from '../../../../utils/withStyles';
import { mockInitialProps } from '../../../../constants/mocks/mockAccounts';
import { mockAccounts } from '../../../../constants/mocks/mockAccounts';
import { mockPayloads } from '../../../../constants/mocks/mockPayloads';
import { mockServices } from '../../../../constants/mocks/mockServices';
import { defaultState } from '../../../../Redux/store';
import {
  networkFetchPayloads,
  networkFetchAccounts,
  networkFetchSvcGroups,
  networkFetchSvcs,
} from '../../../../utils/network';
import {
  createFetchActionCreator,
  closeErrorModal,
  addService,
  updateService,
  deleteService,
  removeGroupAccount,
  fetchServiceToken,
} from '../../../../Redux/actions/network';

// Mock child components with corrected paths
jest.mock('../../../../layouts/EmailDetailsLayout/SearchBox/SearchBox', () => ({
  SearchBox: ({ filterValue, onInputChange }) => (
    <input
      data-testid="search-box"
      value={filterValue}
      onChange={onInputChange}
      placeholder="Filter services..."
    />
  ),
}));

jest.mock('../../../../layouts/EmailDetailsLayout/NavBarView/navBarView', () => ({
  NavBarView: () => <div data-testid="nav-bar">NavBar</div>,
}));

jest.mock('../../../../layouts/EmailDetailsLayout/ScrollListView/ScrollListView', () => ({
  ScrollListView: ({ items, filterValue, filteredItems, listItemClick, handleAddClick }) => {
    const services = filterValue ? filteredItems.items : items.items;
    return (
      <div data-testid="scroll-list">
        <button onClick={handleAddClick}>Add Service</button>
        {services.map((svc) => (
          <div key={svc.id || svc.svc_id} onClick={() => listItemClick(svc)} data-testid={`service-${svc.id || svc.svc_id}`}>
            {svc.name}
          </div>
        ))}
      </div>
    );
  },
}));

jest.mock('../../../../layouts/EmailDetailsLayout/PaginationView/PaginationView', () => ({
  PaginationView: ({ items, filterValue, filteredItems, page, limit, handleNext, handlePrevious, updateLimit }) => {
    const services = filterValue ? filteredItems.items : items.items;
    const totalPages = Math.ceil(services.length / limit);
    return (
      <div data-testid="pagination">
        <span>Page {page}</span>
        <button onClick={handlePrevious} disabled={page === 1}>
          Previous
        </button>
        <button onClick={handleNext} disabled={page === totalPages}>
          Next
        </button>
        <button onClick={() => updateLimit(10, services)}>Set Limit 10</button>
      </div>
    );
  },
}));

jest.mock('../../../../layouts/EmailDetailsLayout/ServiceDetails/ServiceDetails', () => ({
  ServiceDetails: ({
    selectedService,
    toggleAccountConformity,
    startCreatingNewService,
    editExistingSvc,
    openAlertDialog,
  }) => (
    <div data-testid="service-details">
      {selectedService ? <div>Selected: {selectedService.name}</div> : <div>No Service Selected</div>}
      <button onClick={toggleAccountConformity}>Toggle Conformity</button>
      <button onClick={startCreatingNewService}>Create Service</button>
      {selectedService && <button onClick={editExistingSvc}>Edit Service</button>}
      {selectedService && (
        <button
          onClick={() => openAlertDialog({ target: { innerText: 'DEACTIVATE' } })}
          data-testid="deactivate-button"
        >
          Deactivate
        </button>
      )}
    </div>
  ),
}));

jest.mock('../../../../layouts/EmailDetailsLayout/AlertDialog/AlertDialog', () => ({
  AlertDialog: ({ shouldOpen, closeFn, executeFn, description, executeMessage }) =>
    shouldOpen ? (
      <div data-testid="alert-dialog">
        <p>{description}</p>
        <button onClick={closeFn}>Cancel</button>
        <button onClick={executeFn}>{executeMessage}</button>
      </div>
    ) : null,
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => delete store[key],
    length: 0,
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock Redux store
const mockStore = configureStore([]);

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => {
  const actualRouter = jest.requireActual('react-router-dom');
  return {
    ...actualRouter,
    useNavigate: jest.fn<NavigateFunction, []>(),
    useLocation: jest.fn<Location, []>(),
    useParams: jest.fn<Readonly<Params<string>>, []>(),
  };
});

// Mock network utils
jest.mock('../../../../utils/network', () => ({
  networkFetchPayloads: jest.fn().mockImplementation(() => Promise.resolve([])),
  networkFetchAccounts: jest.fn().mockImplementation(() => Promise.resolve([])),
  networkFetchSvcGroups: jest.fn().mockImplementation(() => Promise.resolve([])),
  networkFetchSvcs: jest.fn().mockImplementation(() => Promise.resolve([])),
}));

// Mock Redux actions
jest.mock('../../../../Redux/actions/network', () => ({
  createFetchActionCreator: jest.fn().mockImplementation((typeArg) => {
    const types = {
      SERVICES: 'SERVICES/FETCH',
      ALLSERVICES: 'ALLSERVICES/FETCH',
      ACCOUNTS: 'ACCOUNTS/FETCH',
      GROUPS: 'GROUPS/FETCH',
      PAYLOADS: 'PAYLOADS/FETCH',
    };
    return jest.fn().mockReturnValue({ type: types[typeArg] });
  }),
  closeErrorModal: jest.fn(),
  addService: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
  removeGroupAccount: jest.fn(),
  fetchServiceToken: jest.fn(),
}));

// Define mockUseStyles before using it in jest.mock
const mockUseStyles = jest.fn(() => ({
  classes: {
    views: 'mock-views',
    servicesContainer: 'mock-services-container',
    booleanWrapper: 'mock-boolean-wrapper',
    greenAnswer: 'mock-green-answer',
    redAnswer: 'mock-red-answer',
  },
}));

// Mock the styles module with corrected path
jest.mock('../Services.styles.ts', () => mockUseStyles);

// Initialize the mock store using defaultState and imported mocks
const store = mockStore({
  ...defaultState,
  servicesViewReducer: mockServices,
  accountsViewReducer: mockAccounts,
  linkedAccount: { account: null, groupId: '' },
  unlinkedAccount: { account: null, groupId: '' },
  services: mockServices,
  allservices: mockServices,
  bannerViewReducer: {
    banner: {
      timestamp: '2023-07-20T12:00:00Z',
      banner: 'System Maintenance Notice',
      warning: 'Security Alert: Critical Update Required',
      help_url: 'https://support.example.com',
    },
    isFetching: false,
  },
  payloads: mockPayloads,
});

const mockDispatch = jest.fn();
store.dispatch = mockDispatch;

// Define the initialProps as in the original setup
const initialProps = {
  ...mockInitialProps,
  closeErrorModal,
  fetchSvcs: networkFetchSvcs,
  fetchAllSvcs: networkFetchSvcs,
  fetchServiceToken,
  fetchAccounts: networkFetchAccounts,
  fetchGroups: networkFetchSvcGroups,
  fetchPayloads: networkFetchPayloads,
  addService,
  updateService,
  deleteService,
  removeGroupAccount,
};

describe('ServicesPage Component', () => {
  let mockNavigate: NavigateFunction;
  let mockLocation: Location;
  let mockParams: Readonly<Params<string>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNavigate = jest.fn();
    mockLocation = { pathname: '/services', search: '', hash: '', state: null, key: '' };
    mockParams = { svcId: '' };

    (router.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (router.useLocation as jest.Mock).mockReturnValue(mockLocation);
    (router.useParams as jest.Mock).mockReturnValue(mockParams);

    store.clearActions();
  });

  test('renders ServicesPage with the "Services" text', () => {
    const ServicesViewWithRouter = withRouter(withStyles(() => (
      <Provider store={store}>
        <ServicesView {...initialProps} />
      </Provider>
    )));

    render(
      <MemoryRouter>
        <ServicesViewWithRouter />
      </MemoryRouter>
    );

    expect(screen.getByText(/Services/)).toBeInTheDocument();
  });
});
